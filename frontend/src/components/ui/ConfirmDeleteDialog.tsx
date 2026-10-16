"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Trash2, X, Loader2, ShieldAlert } from "lucide-react";

export interface ConfirmDeleteDialogProps {
  isOpen: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  recordIdentity?: string;
  recordType?: string;
  description?: string;
  warningText?: string;
  hasDependencies?: boolean;
  isIrreversible?: boolean;
  isPending?: boolean;
  confirmButtonText?: string;
  cancelButtonText?: string;
}

export default function ConfirmDeleteDialog({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title,
  recordIdentity,
  recordType,
  description,
  warningText,
  hasDependencies = false,
  isIrreversible = true,
  isPending = false,
  confirmButtonText = "Delete Record",
  cancelButtonText = "Cancel"
}: ConfirmDeleteDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDismiss = () => {
    if (isSubmitting || isPending) return;
    if (onClose) onClose();
    if (onCancel) onCancel();
  };

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isPending && !isSubmitting) {
        handleDismiss();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPending, isSubmitting, onClose, onCancel]);

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSubmitting || isPending) return;

    try {
      setIsSubmitting(true);
      await onConfirm();
    } catch {
      // Errors handled by parent query/mutation toast
    } finally {
      setIsSubmitting(false);
    }
  };

  const busy = isPending || isSubmitting;

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-title"
        >
          {/* Backdrop with standard design token */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!busy) handleDismiss();
            }}
            className="absolute inset-0 bg-[#061B3A]/50 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-lg bg-white border border-[#D8E8FA] rounded-2xl shadow-2xl overflow-hidden z-10 text-[#0B2148]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-[#D8E8FA] flex items-center justify-between bg-[#FEE2E2]/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FEE2E2] border border-[#FECACA] flex items-center justify-center text-[#991B1B] shrink-0 shadow-2xs">
                  {hasDependencies ? (
                    <ShieldAlert className="w-5 h-5 text-[#991B1B]" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-[#991B1B]" />
                  )}
                </div>
                <div>
                  <h3 id="confirm-delete-title" className="text-base font-bold text-[#991B1B]">
                    {title}
                  </h3>
                  {recordType && (
                    <p className="text-[11px] font-semibold text-[#526B91] uppercase tracking-wider">
                      Target Entity: {recordType}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={handleDismiss}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-[#526B91] hover:text-[#0B2148] transition-colors disabled:opacity-50 cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-6 space-y-4">
              {/* Record Identity Highlight Box */}
              {recordIdentity && (
                <div className="p-3 bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#526B91]">
                      Record Identified
                    </p>
                    <p className="text-sm font-mono font-bold text-[#0B2148] truncate">
                      {recordIdentity}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 bg-white border border-[#D8E8FA] rounded text-[10px] font-mono font-bold text-[#526B91] shrink-0">
                    AFFECTED
                  </span>
                </div>
              )}

              {/* Description message */}
              {description ? (
                <p className="text-xs text-[#526B91] leading-relaxed">
                  {description}
                </p>
              ) : (
                <p className="text-xs text-[#526B91] leading-relaxed">
                  Are you sure you want to permanently remove this record? This action will take immediate effect on the system database.
                </p>
              )}

              {/* Stronger Warning for Dependencies or Irreversible deletion */}
              {(hasDependencies || isIrreversible || warningText) && (
                <div className="p-3 bg-amber-50 border border-amber-200/90 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>Warning Notice</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                    {warningText || (
                      hasDependencies
                        ? "This record has active links in BOM templates, work orders, or warehouse inventory. Deletion will be rejected if integrity constraints fail."
                        : "This operation is irreversible. Once removed, historical configuration associations cannot be restored."
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Footer with high-contrast Action Buttons */}
            <div className="p-4 bg-slate-50 border-t border-[#D8E8FA] flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={handleDismiss}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#526B91] hover:text-[#0B2148] hover:bg-slate-200/60 border border-[#D8E8FA] bg-white transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                {cancelButtonText}
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={handleConfirm}
                className="flex items-center gap-1.5 bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-50 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{confirmButtonText}</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
