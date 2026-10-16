"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function QcSettingsRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = (params?.role as string) || "superadmin";

  useEffect(() => {
    router.replace(`/${roleSlug}/admin-settings?tab=qc`);
  }, [roleSlug, router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
    </div>
  );
}
