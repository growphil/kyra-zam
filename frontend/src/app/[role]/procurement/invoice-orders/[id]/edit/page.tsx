"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function InvoiceOrderEditRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const role = (params?.role as string) || "superadmin";
  const id = params?.id as string;

  useEffect(() => {
    if (id) {
      router.replace(`/${role}/procurement/invoice-orders/create?edit=${id}`);
    } else {
      router.replace(`/${role}/procurement/invoice-orders`);
    }
  }, [role, id, router]);

  return (
    <div className="flex flex-col items-center justify-center py-28 gap-3">
      <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin" />
      <span className="text-xs font-semibold text-[#526B91]">Opening draft invoice order editor...</span>
    </div>
  );
}

