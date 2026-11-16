"use client";

import React, { useState, useEffect } from "react";
import { resolveMediaUrl } from "@/lib/api";
import { FileText, Image as ImageIcon, ExternalLink, Download, AlertCircle, Loader2 } from "lucide-react";

export interface MediaPreviewProps {
  url?: string | null;
  mediaId?: string | null;
  fileName?: string;
  fileSize?: number;
  alt?: string;
  className?: string;
  thumbnailClassName?: string;
  showDownload?: boolean;
}

export const MediaPreview: React.FC<MediaPreviewProps> = ({
  url,
  mediaId,
  fileName = "Attachment",
  fileSize,
  alt = "Media Preview",
  className = "",
  thumbnailClassName = "w-12 h-12",
  showDownload = true,
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);

  const effectiveSource = url || (mediaId ? `/media/${mediaId}/file` : "");

  useEffect(() => {
    let isMounted = true;
    if (!effectiveSource) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setHasError(false);

    resolveMediaUrl(effectiveSource)
      .then((res) => {
        if (isMounted) {
          setResolvedUrl(res);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setHasError(true);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [effectiveSource]);

  if (!effectiveSource) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 rounded-lg text-slate-400 ${thumbnailClassName}`}>
        <ImageIcon className="w-5 h-5" />
      </div>
    );
  }

  const isPdf = fileName?.toLowerCase().endsWith(".pdf") || effectiveSource.toLowerCase().includes(".pdf");

  return (
    <div className={`flex items-center gap-3 p-2 rounded-xl border border-[#D8E8FA] bg-white ${className}`}>
      <div
        className={`rounded-lg bg-slate-50 border border-[#D8E8FA] overflow-hidden flex items-center justify-center shrink-0 relative ${thumbnailClassName}`}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 text-[#0878F9] animate-spin" />
        ) : hasError ? (
          <AlertCircle className="w-5 h-5 text-rose-400" />
        ) : isPdf ? (
          <FileText className="w-6 h-6 text-[#0878F9]" />
        ) : (
          <img
            src={resolvedUrl}
            alt={alt}
            onError={() => setHasError(true)}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-[#0B2148] truncate">{fileName}</p>
        <p className="text-[10px] text-[#526B91]">
          {fileSize ? `${(fileSize / 1024).toFixed(1)} KB • ` : ""}AWS S3 Private
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {resolvedUrl && (
          <a
            href={resolvedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-[#0878F9] hover:bg-[#F4F9FF] rounded-lg transition-colors"
            title="Open / View Document"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
};

