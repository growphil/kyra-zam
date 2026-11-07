"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function InvVerifyRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = (params?.role as string) || "inventory-manager";

  useEffect(() => {
    router.replace(`/${roleSlug}/procurement/invoice-orders/verification`);
  }, [roleSlug, router]);

  return null;
}
