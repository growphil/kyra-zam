"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export function useFormattedSerial() {
  const { data: thresholds } = useQuery({
    queryKey: ["admin-thresholds"],
    queryFn: async () => (await api.get("/admin/qc-thresholds")).data,
    staleTime: 5 * 60 * 1000, // Cache settings for 5 minutes to minimize network requests
  });

  const formatSerial = (serial: string): string => {
    if (!serial) return "";
    const len = thresholds?.serialDisplayLength;
    if (len && typeof len === "number" && len > 0 && serial.length > len) {
      return serial.slice(-len);
    }
    return serial;
  };

  return { 
    formatSerial, 
    serialDisplayLength: thresholds?.serialDisplayLength 
  };
}
