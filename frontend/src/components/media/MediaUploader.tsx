"use client";

import React, { useState, useCallback, useRef } from "react";
import { useDropzone, FileRejection } from "react-dropzone";
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, X, FileText, Image as ImageIcon } from "lucide-react";
import { uploadFileToS3 } from "@/lib/api";
import { toast } from "sonner";

export interface MediaUploaderProps {
  category: string;
  entityType?: string;
  entityId?: string;
  accept?: Record<string, string[]>;
  maxSizeMb?: number;
  label?: string;
  hint?: string;
  onUploadComplete?: (result: { mediaId: string; url: string; fileName: string; objectKey: string }) => void;
  onUploadError?: (error: string) => void;
  className?: string;
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  category,
  entityType,
  entityId,
  accept = {
    "image/*": [".jpg", ".jpeg", ".png", ".webp"],
    "application/pdf": [".pdf"],
  },
  maxSizeMb = 20,
  label = "Upload File to Secure S3 Storage",
  hint = "Drag and drop or click to browse",
  onUploadComplete,
  onUploadError,
  className = "",
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number; url?: string } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      if (fileRejections.length > 0) {
        const errorMsg = fileRejections[0].errors[0]?.message || "Invalid file format or size";
        toast.error(errorMsg);
        onUploadError?.(errorMsg);
        return;
      }

      const file = acceptedFiles[0];
      if (!file) return;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsUploading(true);
      setProgress(0);
      setUploadedFile({ name: file.name, size: file.size });

      try {
        const result = await uploadFileToS3(file, category, {
          entityType,
          entityId,
          signal: controller.signal,
          onProgress: (percent) => setProgress(percent),
        });

        toast.success(`"${file.name}" uploaded successfully to S3`);
        setUploadedFile({ name: file.name, size: file.size, url: result.url });
        onUploadComplete?.(result);
      } catch (err: any) {
        if (controller.signal.aborted) {
          toast.info("Upload cancelled");
        } else {
          const msg = err.response?.data?.error || err.message || "Upload to AWS S3 failed";
          toast.error(msg);
          onUploadError?.(msg);
        }
        setUploadedFile(null);
      } finally {
        setIsUploading(false);
        abortControllerRef.current = null;
      }
    },
    [category, entityType, entityId, onUploadComplete, onUploadError]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize: maxSizeMb * 1024 * 1024,
    multiple: false,
    disabled: isUploading,
  });

  const clearUploaded = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadedFile(null);
    setProgress(0);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
          isDragActive
            ? "border-[#0878F9] bg-[#F0F7FF]"
            : isUploading
            ? "border-slate-300 bg-slate-50 cursor-not-allowed"
            : uploadedFile?.url
            ? "border-emerald-400 bg-emerald-50/40"
            : "border-[#D8E8FA] hover:border-[#0878F9] hover:bg-[#F4F9FF]"
        }`}
      >
        <input {...getInputProps()} />

        {isUploading ? (
          <div className="space-y-3 py-2">
            <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin mx-auto" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#0B2148]">
                Uploading to S3... {progress}%
              </p>
              <div className="w-48 h-2 bg-slate-200 rounded-full mx-auto overflow-hidden">
                <div
                  className="h-full bg-[#0878F9] transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500">{uploadedFile?.name}</p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    abortControllerRef.current?.abort();
                  }}
                  className="px-2.5 py-1 text-[11px] font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors"
                >
                  Cancel Upload
                </button>
              </div>
            </div>
          </div>
        ) : uploadedFile?.url ? (
          <div className="flex items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#0B2148] truncate">{uploadedFile.name}</p>
                <p className="text-[10px] text-emerald-700 font-medium">
                  {(uploadedFile.size / 1024).toFixed(1)} KB • Stored in AWS S3
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={clearUploaded}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              title="Replace file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-2 py-1">
            <div className="w-10 h-10 rounded-xl bg-[#EAF5FF] text-[#0878F9] flex items-center justify-center mx-auto">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#0B2148]">{label}</p>
              <p className="text-[11px] text-[#526B91] mt-0.5">{hint}</p>
              <p className="text-[10px] text-slate-400 mt-1 font-mono">Max size: {maxSizeMb} MB</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

