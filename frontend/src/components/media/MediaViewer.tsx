"use client";

import React, { useState, useEffect } from "react";
import { resolveMediaUrl } from "@/lib/api";
import { X, Download, ExternalLink, Loader2, AlertCircle, ZoomIn, ZoomOut, RotateCw } from "lucide-react";

export interface MediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  url?: string | null;
  mediaId?: string | null;
  fileName?: string;
  title?: string;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  isOpen,
  onClose,
  url,
  mediaId,
  fileName = "Document",
  title = "Document Preview",
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  const effectiveSource = url || (mediaId ? `/media/${mediaId}/file` : "");

  useEffect(() => {
    let isMounted = true;
    if (!isOpen || !effectiveSource) return;

    setIsLoading(true);
    setHasError(false);
    setZoom(1);
    setRotation(0);

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
  }, [isOpen, effectiveSource]);

  if (!isOpen) return null;

  const isPdf = fileName?.toLowerCase().endsWith(".pdf") || effectiveSource.toLowerCase().includes(".pdf");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-sm font-bold text-[#0B2148]">{title}</h3>
            <p className="text-[11px] text-slate-500 truncate max-w-md">{fileName}</p>
          </div>

          <div className="flex items-center gap-2">
            {!isPdf && resolvedUrl && (
              <>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(z + 0.25, 2.5))}
                  className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                  className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Rotate"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </>
            )}

            {resolvedUrl && (
              <a
                href={resolvedUrl}
                download={fileName}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-[#0878F9] hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                title="Download"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download</span>
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors ml-2"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100/50 min-h-[300px]">
          {isLoading ? (
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin" />
              <p className="text-xs">Loading secure document from S3...</p>
            </div>
          ) : hasError ? (
            <div className="flex flex-col items-center gap-2 text-rose-500">
              <AlertCircle className="w-8 h-8" />
              <p className="text-xs font-semibold">Failed to load document from S3</p>
            </div>
          ) : isPdf ? (
            <iframe
              src={resolvedUrl}
              className="w-full h-[70vh] rounded-lg border border-slate-300"
              title={fileName}
            />
          ) : (
            <div className="overflow-auto max-h-[70vh] flex items-center justify-center">
              <img
                src={resolvedUrl}
                alt={fileName}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: "transform 0.2s ease-out",
                }}
                className="max-h-[65vh] max-w-full rounded-lg object-contain shadow-md"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

