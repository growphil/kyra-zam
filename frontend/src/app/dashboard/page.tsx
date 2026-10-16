"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function DashboardRedirect() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      const userRoles = (session?.user as any)?.roles || [];
      const primaryRole = userRoles[0];
      if (primaryRole) {
        const roleSlug = primaryRole.toLowerCase().replace(/_/g, "-");
        if (primaryRole === "PAX_TEST_ENGINEER" || roleSlug === "pax-test-engineer") {
          router.push(`/${roleSlug}/pax-testing`);
        } else if (primaryRole === "PACKING_OPERATOR" || primaryRole === "PACKING" || roleSlug === "packing-operator") {
          router.push(`/${roleSlug}/packing`);
        } else {
          router.push(`/${roleSlug}`);
        }
      } else {
        router.push("/login");
      }
    } else if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, session, router]);

  return (
    <div className="min-h-screen bg-[#F4F9FF] text-[#0B2148] flex flex-col items-center justify-center">
      <Loader2 className="w-10 h-10 text-[#0878F9] animate-spin mb-3" />
      <p className="text-sm font-semibold text-[#526B91]">Redirecting to workspace...</p>
    </div>
  );
}
