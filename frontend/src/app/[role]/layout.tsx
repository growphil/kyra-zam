"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import ErrorBoundary from "@/components/ui/ErrorBoundary";

export default function RoleLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const currentRoleSlug = params.role as string;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      const userRoles = (session?.user as any)?.roles || [];
      const primaryRole = userRoles[0];
      if (primaryRole) {
        const expectedSlug = primaryRole.toLowerCase().replace(/_/g, "-");
        const allowedSlugs = userRoles.map((role: string) => role.toLowerCase().replace(/_/g, "-"));
        // If user is trying to access a different role's dashboard they do not hold, redirect to their own primary
        if (currentRoleSlug && !allowedSlugs.includes(currentRoleSlug) && currentRoleSlug !== "dashboard") {
          if (expectedSlug === "pax-test-engineer") {
            router.push(`/${expectedSlug}/pax-testing`);
          } else if (expectedSlug === "hr-payroll") {
            router.push(`/${expectedSlug}/hr/dashboard`);
          } else {
            router.push(`/${expectedSlug}`);
          }
        }
      }
    }
  }, [status, session, router, currentRoleSlug]);

  if (status === "loading") {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-12">
        <Loader2 className="w-10 h-10 text-[#0878F9] animate-spin mb-3" />
        <p className="text-xs font-semibold text-[#526B91]">Verifying role permissions & session...</p>
      </div>
    );
  }

  const userRoles = (session?.user as any)?.roles || [];
  const isPaxTestEngineerOnly =
    (currentRoleSlug === "pax-test-engineer" || userRoles.includes("PAX_TEST_ENGINEER")) &&
    !userRoles.includes("ADMIN") &&
    !userRoles.includes("SUPERADMIN");

  const isSellerOnly =
    (currentRoleSlug === "seller" || userRoles.includes("SELLER")) &&
    !userRoles.includes("ADMIN") &&
    !userRoles.includes("SUPERADMIN");

  const isHrPayrollOnly =
    (currentRoleSlug === "hr-payroll" || userRoles.includes("HR_PAYROLL")) &&
    !userRoles.includes("ADMIN") &&
    !userRoles.includes("SUPERADMIN");

  // Determine subroute beyond /[role]
  const pathParts = pathname.split("/").filter(Boolean);
  const subRoute = pathParts[1];

  // For PAX Test Engineer, only root of the role (which redirects to pax-testing) and pax-testing are permitted
  const isPaxRouteAllowed = !subRoute || subRoute === "pax-testing";

  if (isPaxTestEngineerOnly && currentRoleSlug === "pax-test-engineer" && !isPaxRouteAllowed) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-[#0B2148]">Access Restricted</h2>
        <p className="text-[#526B91] text-sm max-w-md">
          Your role (PAX Test Engineer) is only authorized to access the PAX Testing station.
        </p>
        <button
          onClick={() => router.push(`/${currentRoleSlug}/pax-testing`)}
          className="btn-primary mt-2 text-xs"
        >
          Return to PAX Testing Station
        </button>
      </div>
    );
  }

  // For SELLER: only Finished Goods, Sales, and Warranty records are permitted
  let isSellerRouteAllowed = true;
  if (isSellerOnly && (currentRoleSlug === "seller" || userRoles.includes("SELLER"))) {
    if (!subRoute) {
      isSellerRouteAllowed = true;
    } else if (subRoute === "sales" || subRoute === "finished-goods" || subRoute === "warranties") {
      isSellerRouteAllowed = true;
    } else if (subRoute === "inventory" && pathParts[2] === "finished-goods") {
      isSellerRouteAllowed = true;
    } else if (subRoute === "service" && pathParts[2] === "warranties") {
      isSellerRouteAllowed = true;
    } else {
      isSellerRouteAllowed = false;
    }
  }

  if (isSellerOnly && currentRoleSlug === "seller" && !isSellerRouteAllowed) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-[#0B2148]">Access Restricted — Seller Scope</h2>
        <p className="text-[#526B91] text-sm max-w-md">
          Your role (Seller) is strictly restricted to Finished Goods sales, customer registration, and warranty records. Manufacturing, PAX testing, packing, warehouse administration, and finance clearance are prohibited.
        </p>
        <button
          onClick={() => router.push(`/${currentRoleSlug}/finished-goods`)}
          className="btn-primary mt-2 text-xs"
        >
          Return to Finished Goods
        </button>
      </div>
    );
  }

  // For HR_PAYROLL: only hr routes and root are permitted
  const isHrRouteAllowed = !subRoute || subRoute === "hr";
  if (isHrPayrollOnly && (currentRoleSlug === "hr-payroll" || userRoles.includes("HR_PAYROLL")) && !isHrRouteAllowed) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-[#0B2148]">Access Restricted — HR &amp; Payroll Scope</h2>
        <p className="text-[#526B91] text-sm max-w-md">
          Your role (HR &amp; Payroll) is authorized solely for Human Resources, Attendance, Working Calendar, Leave, and Zambia Statutory Payroll. Unrelated manufacturing, sales, procurement, warehouse, or financial clearance operations are prohibited.
        </p>
        <button
          onClick={() => router.push(`/${currentRoleSlug}/hr/dashboard`)}
          className="btn-primary mt-2 text-xs"
        >
          Return to HR Dashboard
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="w-full min-w-0 max-w-full">
        {children}
      </div>
    </ErrorBoundary>
  );
}
