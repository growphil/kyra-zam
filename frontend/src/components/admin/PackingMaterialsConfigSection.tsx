"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Package,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronUp,
  ChevronDown,
  Edit2,
  Sparkles,
  Info,
  Check,
  X,
  Layers,
  Tag,
  ShieldCheck,
  Sliders,
  Copy,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export interface PackingMaterialItem {
  id?: string;
  name: string;
  materialCode?: string;
  quantity: number;
  unit: string;
  isRequired: boolean;
  conditionOptions: string;
  notes: string;
  isActive: boolean;
  displayOrder: number;
}

const UNIT_OPTIONS = ["PCS", "SET", "BOX", "METER", "PAIR", "KG", "ROLL", "KIT"];
const CONDITION_PRESETS = [
  { value: "GOOD,DAMAGED,NA", label: "Good / Damaged / N/A" },
  { value: "GOOD,DAMAGED", label: "Good / Damaged Only" },
  { value: "GOOD_ONLY", label: "Pass / Verified Only" }
];

const STANDARD_PACKING_TEMPLATE: PackingMaterialItem[] = [
  {
    name: "Fast Battery Charger",
    materialCode: "CHG-FAST-AUTO",
    quantity: 1,
    unit: "PCS",
    isRequired: true,
    conditionOptions: "GOOD,DAMAGED,NA",
    notes: "Verify voltage rating and output plug connector",
    isActive: true,
    displayOrder: 0
  },
  {
    name: "AC Power Charging Cable",
    materialCode: "CAB-AC-3PIN",
    quantity: 1,
    unit: "PCS",
    isRequired: true,
    conditionOptions: "GOOD,DAMAGED,NA",
    notes: "Standard 3-pin heavy duty power cable",
    isActive: true,
    displayOrder: 1
  },
  {
    name: "User Safety & Operations Manual",
    materialCode: "DOC-MANUAL-KZ",
    quantity: 1,
    unit: "PCS",
    isRequired: true,
    conditionOptions: "GOOD,DAMAGED,NA",
    notes: "Official KYRA ZAM multilingual instruction guide",
    isActive: true,
    displayOrder: 2
  },
  {
    name: "Warranty Certificate Card",
    materialCode: "DOC-WTY-CARD",
    quantity: 1,
    unit: "PCS",
    isRequired: true,
    conditionOptions: "GOOD,DAMAGED,NA",
    notes: "Verify serialized sticker matches pack warranty number",
    isActive: true,
    displayOrder: 3
  },
  {
    name: "Mounting Bracket & Fastener Kit",
    materialCode: "HW-MNT-KIT",
    quantity: 1,
    unit: "SET",
    isRequired: true,
    conditionOptions: "GOOD,DAMAGED,NA",
    notes: "Complete corrosion-resistant stainless bracket set",
    isActive: true,
    displayOrder: 4
  },
  {
    name: "High-Density Protective EPE Foam Set",
    materialCode: "PKG-FOAM-EPE",
    quantity: 2,
    unit: "SET",
    isRequired: true,
    conditionOptions: "GOOD,DAMAGED,NA",
    notes: "Top and bottom shock-absorbing foam inserts",
    isActive: true,
    displayOrder: 5
  },
  {
    name: "Heavy-Duty Corrugated Outer Carton",
    materialCode: "PKG-BOX-CORR",
    quantity: 1,
    unit: "BOX",
    isRequired: true,
    conditionOptions: "GOOD,DAMAGED,NA",
    notes: "UN 3480 Class 9 lithium hazard marked carton",
    isActive: true,
    displayOrder: 6
  }
];

export default function PackingMaterialsConfigSection() {
  const queryClient = useQueryClient();

  // Selected Model
  const [selectedPaxTypeId, setSelectedPaxTypeId] = useState<string>("");

  // Local checklist working state (for draft / edits)
  const [items, setItems] = useState<PackingMaterialItem[]>([]);
  const [initialItems, setInitialItems] = useState<PackingMaterialItem[]>([]);

  // Modal / Form state for Add or Edit
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState<PackingMaterialItem>({
    name: "",
    materialCode: "",
    quantity: 1,
    unit: "PCS",
    isRequired: true,
    conditionOptions: "GOOD,DAMAGED,NA",
    notes: "",
    isActive: true,
    displayOrder: 0
  });

  // Delete confirmation
  const [itemToDeleteIndex, setItemToDeleteIndex] = useState<number | null>(null);

  // 1. Fetch Pax Types
  const { data: paxTypes, isLoading: loadingPaxTypes } = useQuery({
    queryKey: ["admin-pax-types-packing"],
    queryFn: async () => {
      const res = await api.get("/cells/pax-types");
      const list = res.data || [];
      if (list.length > 0 && !selectedPaxTypeId) {
        setSelectedPaxTypeId(list[0].id);
      }
      return list;
    }
  });

  // Selected PaxType Object
  const currentPaxType = useMemo(() => {
    return paxTypes?.find((p: any) => p.id === selectedPaxTypeId);
  }, [paxTypes, selectedPaxTypeId]);

  // 2. Fetch Material Configuration for selected model
  const { data: configsData, isLoading: loadingConfigs, isFetching } = useQuery({
    queryKey: ["packing-material-configs", selectedPaxTypeId],
    queryFn: async () => {
      if (!selectedPaxTypeId) return [];
      const res = await api.get(`/packing/materials/config?paxTypeId=${selectedPaxTypeId}`);
      const data = res.data || [];
      return data.map((d: any, idx: number) => ({
        id: d.id,
        name: d.name,
        materialCode: d.materialCode || "",
        quantity: d.quantity || 1,
        unit: d.unit || "PCS",
        isRequired: d.isRequired ?? true,
        conditionOptions: d.conditionOptions || "GOOD,DAMAGED,NA",
        notes: d.notes || d.instructions || "",
        isActive: d.isActive !== undefined ? d.isActive : true,
        displayOrder: d.displayOrder !== undefined ? d.displayOrder : idx
      }));
    },
    enabled: !!selectedPaxTypeId
  });

  // Sync loaded configs into local editor state
  useEffect(() => {
    if (configsData) {
      setItems(configsData);
      setInitialItems(configsData);
    }
  }, [configsData]);

  // Detect dirty / unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (items.length !== initialItems.length) return true;
    return JSON.stringify(items) !== JSON.stringify(initialItems);
  }, [items, initialItems]);

  // Client validation
  const validationErrors = useMemo(() => {
    const errors: Record<number, string[]> = {};
    const namesCount: Record<string, number> = {};

    items.forEach((item) => {
      const trimmed = item.name.trim().toLowerCase();
      if (trimmed) {
        namesCount[trimmed] = (namesCount[trimmed] || 0) + 1;
      }
    });

    items.forEach((item, index) => {
      const itemErrors: string[] = [];
      const trimmed = item.name.trim();

      if (!trimmed) {
        itemErrors.push("Material name cannot be empty.");
      } else if (namesCount[trimmed.toLowerCase()] > 1) {
        itemErrors.push("Duplicate material name detected.");
      }

      if (item.quantity <= 0) {
        itemErrors.push("Quantity must be greater than zero.");
      }

      if (itemErrors.length > 0) {
        errors[index] = itemErrors;
      }
    });

    return errors;
  }, [items]);

  const hasAnyValidationError = Object.keys(validationErrors).length > 0;

  // 3. Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPaxTypeId) throw new Error("No model selected.");
      if (hasAnyValidationError) {
        throw new Error("Please resolve all validation errors before saving.");
      }
      return (
        await api.post("/packing/materials/config", {
          paxTypeId: selectedPaxTypeId,
          materials: items.map((it, idx) => ({
            name: it.name.trim(),
            materialCode: it.materialCode?.trim() || null,
            quantity: Number(it.quantity) || 1,
            unit: it.unit || "PCS",
            isRequired: it.isRequired,
            conditionOptions: it.conditionOptions,
            notes: it.notes?.trim() || "",
            isActive: it.isActive,
            displayOrder: idx
          }))
        })
      ).data;
    },
    onSuccess: (data) => {
      toast.success(
        `Packing configuration saved successfully for ${currentPaxType?.name || "model"} (${items.length} items)`
      );
      queryClient.invalidateQueries({ queryKey: ["packing-material-configs", selectedPaxTypeId] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err.message || "Failed to save configuration");
    }
  });

  // --- ACTIONS ---

  const handleOpenAddModal = () => {
    setEditingIndex(null);
    setModalForm({
      name: "",
      materialCode: "",
      quantity: 1,
      unit: "PCS",
      isRequired: true,
      conditionOptions: "GOOD,DAMAGED,NA",
      notes: "",
      isActive: true,
      displayOrder: items.length
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (index: number) => {
    setEditingIndex(index);
    setModalForm({ ...items[index] });
    setIsModalOpen(true);
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = modalForm.name.trim();

    if (!trimmedName) {
      toast.error("Material name is required.");
      return;
    }

    if (modalForm.quantity <= 0) {
      toast.error("Quantity must be greater than zero.");
      return;
    }

    if (editingIndex === null) {
      // Check duplicate
      if (items.some((it) => it.name.trim().toLowerCase() === trimmedName.toLowerCase())) {
        toast.error(`A material with the name "${trimmedName}" already exists in this checklist.`);
        return;
      }
      setItems((prev) => [
        ...prev,
        {
          ...modalForm,
          name: trimmedName,
          displayOrder: prev.length
        }
      ]);
      toast.success(`Added "${trimmedName}" to checklist`);
    } else {
      // Check duplicate against others
      if (
        items.some(
          (it, idx) =>
            idx !== editingIndex && it.name.trim().toLowerCase() === trimmedName.toLowerCase()
        )
      ) {
        toast.error(`Another material is already named "${trimmedName}".`);
        return;
      }
      setItems((prev) =>
        prev.map((it, idx) =>
          idx === editingIndex
            ? {
                ...modalForm,
                name: trimmedName
              }
            : it
        )
      );
      toast.success(`Updated "${trimmedName}"`);
    }

    setIsModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (itemToDeleteIndex !== null) {
      const removedName = items[itemToDeleteIndex]?.name;
      setItems((prev) =>
        prev
          .filter((_, idx) => idx !== itemToDeleteIndex)
          .map((item, idx) => ({ ...item, displayOrder: idx }))
      );
      toast.info(`Removed "${removedName}" from checklist`);
      setItemToDeleteIndex(null);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setItems((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy.map((it, idx) => ({ ...it, displayOrder: idx }));
    });
  };

  const handleMoveDown = (index: number) => {
    if (index >= items.length - 1) return;
    setItems((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy.map((it, idx) => ({ ...it, displayOrder: idx }));
    });
  };

  const handleToggleActive = (index: number) => {
    setItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, isActive: !it.isActive } : it))
    );
  };

  const handleToggleRequired = (index: number) => {
    setItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, isRequired: !it.isRequired } : it))
    );
  };

  const handleApplyStandardTemplate = () => {
    if (
      items.length > 0 &&
      !window.confirm(
        "This model already has configured materials. Do you want to append standard essentials to the checklist?"
      )
    ) {
      return;
    }

    const existingNames = new Set(items.map((i) => i.name.trim().toLowerCase()));
    const newItemsToAdd = STANDARD_PACKING_TEMPLATE.filter(
      (tpl) => !existingNames.has(tpl.name.trim().toLowerCase())
    );

    if (newItemsToAdd.length === 0) {
      toast.info("All standard template items are already present in this checklist.");
      return;
    }

    setItems((prev) => [
      ...prev,
      ...newItemsToAdd.map((it, idx) => ({
        ...it,
        displayOrder: prev.length + idx
      }))
    ]);
    toast.success(`Appended ${newItemsToAdd.length} standard packaging components.`);
  };

  const handleCancelChanges = () => {
    setItems(initialItems);
    toast.info("Unsaved modifications reverted to backend standard.");
  };

  return (
    <div className="space-y-4">
      {/* ── 1. SECTION HEADER & METRICS ──────────────────────────────────── */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#D8E8FA] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#0878F9]" />
            <h2 className="text-base sm:text-lg font-bold text-[#0B2148]">
              Packing Materials & Checklist Configuration
            </h2>
          </div>
          <p className="text-xs text-[#526B91] mt-0.5">
            Configure mandatory packaging accessories, cables, manuals, warranty cards, cushions and boxes verified during shop-floor packing.
          </p>
        </div>

        {/* Action Controls & Dirty Badge */}
        <div className="flex flex-wrap items-center gap-2.5">
          {hasUnsavedChanges ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-[#92400E]" />
              Unsaved Changes Pending
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]">
              <Check className="w-3.5 h-3.5" />
              All Changes Saved
            </span>
          )}

          {hasUnsavedChanges && (
            <button
              onClick={handleCancelChanges}
              disabled={saveMutation.isPending}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#F4F9FF] text-[#526B91] hover:text-[#0B2148] border border-[#D8E8FA] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Revert
            </button>
          )}

          <button
            onClick={handleOpenAddModal}
            className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#EAF5FF] text-[#0878F9] border border-[#D8E8FA] hover:border-[#0878F9]/30 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Material
          </button>

          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !hasUnsavedChanges || hasAnyValidationError}
            className="px-4 py-1.5 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save Configuration
          </button>
        </div>
      </div>

      {/* ── 2. PRODUCT / MODEL SELECTOR ───────────────────────────────────── */}
      <div className="bg-white p-4 rounded-xl border border-[#D8E8FA] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-[#526B91] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#0878F9]" />
            Select Target Battery Product / Model (PaxType)
          </label>
          <span className="text-[11px] text-[#526B91]">
            Different models load their own distinct packaging checklists during shop-floor packing.
          </span>
        </div>

        {loadingPaxTypes ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#0878F9] mx-auto" />
            <p className="text-xs text-[#526B91] mt-2">Loading battery models...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {paxTypes?.map((pt: any) => {
              const isSelected = selectedPaxTypeId === pt.id;
              return (
                <button
                  key={pt.id}
                  type="button"
                  onClick={() => {
                    if (hasUnsavedChanges) {
                      if (
                        !window.confirm(
                          "You have unsaved changes in the current model checklist. Discard and switch models?"
                        )
                      ) {
                        return;
                      }
                    }
                    setSelectedPaxTypeId(pt.id);
                  }}
                  className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[#EAF5FF] border-[#0878F9] text-[#0878F9] shadow-xs ring-1 ring-[#0878F9]/30"
                      : "bg-[#F4F9FF] border-[#D8E8FA] text-[#526B91] hover:text-[#0B2148] hover:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs truncate">{pt.name}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#0878F9] shrink-0" />}
                  </div>
                  <div className="text-[11px] text-[#526B91] mt-0.5 truncate">
                    {pt.configuration} • {pt.nominalVoltage}V {pt.nominalCapacity}Ah ({pt.cellCount} Cells)
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 3. MATERIAL CHECKLIST EDITOR TABLE ───────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#D8E8FA] shadow-xs overflow-hidden">
        {/* Table Subheader */}
        <div className="px-5 py-3.5 border-b border-[#D8E8FA] bg-[#F4F9FF] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#0878F9]" />
            <span className="text-xs font-bold text-[#0B2148]">
              {currentPaxType?.name || "Model"} Checklist Items ({items.length})
            </span>
            <span className="text-[11px] text-[#526B91] font-mono">
              ({items.filter((i) => i.isRequired && i.isActive).length} mandatory, {items.filter((i) => !i.isRequired && i.isActive).length} optional)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleApplyStandardTemplate}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#EAF5FF] text-[#0B2148] border border-[#D8E8FA] text-[11px] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Append standard battery packaging items"
            >
              <Sparkles className="w-3 h-3 text-[#FFC928]" />
              Append Standard Template
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          {loadingConfigs || isFetching ? (
            <div className="p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#0878F9] mx-auto" />
              <p className="text-xs text-[#526B91] mt-2">Loading checklist requirements...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Package className="w-10 h-10 mx-auto text-[#526B91]" />
              <div className="text-sm font-bold text-[#0B2148]">
                No Packing Materials Configured for {currentPaxType?.name}
              </div>
              <p className="text-xs text-[#526B91] max-w-md mx-auto">
                Packs for this model cannot be processed at the packing station until at least one packaging requirement is configured.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={handleApplyStandardTemplate}
                  className="px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white text-xs font-semibold flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Load Standard Packaging Checklist
                </button>
                <button
                  onClick={handleOpenAddModal}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-[#F4F9FF] text-[#0B2148] border border-[#D8E8FA] text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Custom Material
                </button>
              </div>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#D8E8FA] bg-[#F4F9FF] text-[11px] uppercase font-bold text-[#526B91] tracking-wider">
                  <th className="py-2.5 px-3 pl-5 w-20 text-center">S.No / Order</th>
                  <th className="py-2.5 px-3">Material Name & SKU</th>
                  <th className="py-2.5 px-3 w-28 text-center">Qty & Unit</th>
                  <th className="py-2.5 px-3 w-28 text-center">Rule</th>
                  <th className="py-2.5 px-3">Condition Options</th>
                  <th className="py-2.5 px-3">Packing Instructions / Notes</th>
                  <th className="py-2.5 px-3 w-20 text-center">Active</th>
                  <th className="py-2.5 px-3 pr-5 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E8FA]">
                {items.map((item, idx) => {
                  const errorList = validationErrors[idx] || [];
                  const isFirst = idx === 0;
                  const isLast = idx === items.length - 1;

                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-[#F4F9FF]/80 transition-colors ${
                        !item.isActive ? "opacity-60 bg-slate-50/50" : ""
                      } ${errorList.length > 0 ? "bg-rose-50/40" : ""}`}
                    >
                      {/* Reorder Buttons */}
                      <td className="py-2.5 px-3 pl-5 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleMoveUp(idx)}
                            disabled={isFirst}
                            className="p-1 rounded hover:bg-[#D8E8FA] disabled:opacity-20 text-[#526B91] cursor-pointer"
                            title="Move Up"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-mono font-bold text-[#526B91] w-4 text-center">
                            {idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleMoveDown(idx)}
                            disabled={isLast}
                            className="p-1 rounded hover:bg-[#D8E8FA] disabled:opacity-20 text-[#526B91] cursor-pointer"
                            title="Move Down"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Material Name & SKU */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-[#0B2148]">{item.name}</div>
                        {item.materialCode && (
                          <div className="text-[10px] font-mono text-[#0878F9] mt-0.5 flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            {item.materialCode}
                          </div>
                        )}
                        {errorList.length > 0 && (
                          <div className="text-[10px] text-[#991B1B] font-semibold mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {errorList.join(" ")}
                          </div>
                        )}
                      </td>

                      {/* Qty & Unit */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="font-mono font-bold text-[#0B2148]">
                          {item.quantity} {item.unit}
                        </span>
                      </td>

                      {/* Required / Optional */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleRequired(idx)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase cursor-pointer border transition-colors ${
                            item.isRequired
                              ? "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA] hover:bg-[#FECACA]"
                              : "bg-[#F1F5F9] text-[#475569] border-[#E2E8F0] hover:bg-[#E2E8F0]"
                          }`}
                          title="Click to toggle Required / Optional"
                        >
                          {item.isRequired ? "Required" : "Optional"}
                        </button>
                      </td>

                      {/* Condition Options */}
                      <td className="py-2.5 px-3">
                        <span className="text-[11px] text-[#526B91] bg-[#F4F9FF] px-2 py-0.5 rounded border border-[#D8E8FA]">
                          {item.conditionOptions === "GOOD,DAMAGED,NA"
                            ? "Good / Damaged / N/A"
                            : item.conditionOptions === "GOOD,DAMAGED"
                            ? "Good / Damaged"
                            : "Good Only"}
                        </span>
                      </td>

                      {/* Notes / Instructions */}
                      <td className="py-2.5 px-3">
                        <div className="text-[11px] text-[#526B91] max-w-xs truncate" title={item.notes}>
                          {item.notes || <span className="italic text-slate-400">None</span>}
                        </div>
                      </td>

                      {/* Active Status */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(idx)}
                          className={`w-4 h-4 rounded inline-flex items-center justify-center border cursor-pointer transition-colors ${
                            item.isActive
                              ? "bg-[#166534] border-[#166534] text-white"
                              : "border-[#D8E8FA] bg-white text-transparent"
                          }`}
                          title={item.isActive ? "Deactivate item" : "Activate item"}
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 pr-5 text-right space-x-1 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(idx)}
                          className="p-1.5 rounded-lg text-[#526B91] hover:text-[#0878F9] hover:bg-[#EAF5FF] transition-colors cursor-pointer"
                          title="Edit Material"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setItemToDeleteIndex(idx)}
                          className="p-1.5 rounded-lg text-[#526B91] hover:text-[#991B1B] hover:bg-[#FEE2E2] transition-colors cursor-pointer"
                          title="Remove Material"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── 4. ADD / EDIT MATERIAL MODAL ──────────────────────────────────── */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#061B3A]/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div className="bg-white border border-[#D8E8FA] rounded-2xl p-5 sm:p-6 max-w-2xl w-full shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#D8E8FA] pb-3">
                <div className="flex items-center gap-2 text-[#0B2148] font-bold text-sm">
                  <Package className="w-4 h-4 text-[#0878F9]" />
                  {editingIndex === null ? "Add Packaging Material" : "Edit Packaging Material"}
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-[#EAF5FF] text-[#526B91]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleModalSubmit} className="space-y-3.5 text-xs">
                {/* Name */}
                <div>
                  <label className="block font-semibold text-[#0B2148] mb-1">
                    Material Name <span className="text-[#991B1B]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fast Battery Charger (54.6V 5A)"
                    value={modalForm.name}
                    onChange={(e) => setModalForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-[#0878F9]"
                  />
                </div>

                {/* SKU Code */}
                <div>
                  <label className="block font-semibold text-[#0B2148] mb-1">
                    Material Code / SKU (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CHG-54V-5A"
                    value={modalForm.materialCode}
                    onChange={(e) => setModalForm((prev) => ({ ...prev, materialCode: e.target.value }))}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-[#0B2148] font-mono placeholder-[#64748B] focus:outline-none focus:border-[#0878F9]"
                  />
                </div>

                {/* Qty & Unit */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#0B2148] mb-1">
                      Required Quantity <span className="text-[#991B1B]">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={modalForm.quantity}
                      onChange={(e) =>
                        setModalForm((prev) => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value, 10) || 1) }))
                      }
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-[#0B2148] font-bold focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#0B2148] mb-1">
                      Unit of Measurement
                    </label>
                    <select
                      value={modalForm.unit}
                      onChange={(e) => setModalForm((prev) => ({ ...prev, unit: e.target.value }))}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    >
                      {UNIT_OPTIONS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Condition Preset */}
                <div>
                  <label className="block font-semibold text-[#0B2148] mb-1">
                    Permitted Condition Choices
                  </label>
                  <select
                    value={modalForm.conditionOptions}
                    onChange={(e) => setModalForm((prev) => ({ ...prev, conditionOptions: e.target.value }))}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                  >
                    {CONDITION_PRESETS.map((cp) => (
                      <option key={cp.value} value={cp.value}>
                        {cp.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Instructions / Notes */}
                <div>
                  <label className="block font-semibold text-[#0B2148] mb-1">
                    Packing Instructions for Operator
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Verify voltage rating matches pack configuration"
                    value={modalForm.notes}
                    onChange={(e) => setModalForm((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-[#0878F9]"
                  />
                </div>

                {/* Toggles: Required & Active */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={modalForm.isRequired}
                      onChange={(e) => setModalForm((prev) => ({ ...prev, isRequired: e.target.checked }))}
                      className="rounded accent-[#0878F9] w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <div className="font-bold text-[#0B2148]">Mandatory Item</div>
                      <div className="text-[10px] text-[#526B91]">Must be verified to pack</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={modalForm.isActive}
                      onChange={(e) => setModalForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                      className="rounded accent-[#0878F9] w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <div className="font-bold text-[#0B2148]">Active Status</div>
                      <div className="text-[10px] text-[#526B91]">Include in packing queue</div>
                    </div>
                  </label>
                </div>

                {/* Modal Footer */}
                <div className="flex justify-end gap-2 pt-3 border-t border-[#D8E8FA]">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#F4F9FF] text-[#526B91] border border-[#D8E8FA] font-semibold text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-semibold text-xs shadow-xs transition-colors"
                  >
                    {editingIndex === null ? "Add to Checklist" : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 5. DELETE CONFIRMATION DIALOG ─────────────────────────────────── */}
      <AnimatePresence>
        {itemToDeleteIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#061B3A]/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div className="bg-white border border-[#D8E8FA] rounded-2xl p-5 max-w-md w-full shadow-xl space-y-3">
              <div className="flex items-center gap-2 text-[#991B1B] font-bold text-sm">
                <Trash2 className="w-4 h-4" />
                Remove Packaging Material?
              </div>
              <p className="text-xs text-[#526B91]">
                Are you sure you want to remove{" "}
                <strong className="text-[#0B2148]">
                  "{items[itemToDeleteIndex]?.name}"
                </strong>{" "}
                from {currentPaxType?.name}'s checklist?
              </p>
              <div className="flex justify-end gap-2 pt-2 border-t border-[#D8E8FA]">
                <button
                  type="button"
                  onClick={() => setItemToDeleteIndex(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#526B91] hover:bg-[#F4F9FF] border border-[#D8E8FA]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-3.5 py-1.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-semibold shadow-xs"
                >
                  Remove Material
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
