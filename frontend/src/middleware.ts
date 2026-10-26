import { auth } from "@/auth";
import { NextResponse } from "next/server";

function getRoleRedirect(roles: string[] = []): string {
  const primaryRole = roles[0];
  if (!primaryRole) return "/login";
  const roleSlug = primaryRole.toLowerCase().replace(/_/g, "-");
  if (primaryRole === "PAX_TEST_ENGINEER" || roleSlug === "pax-test-engineer") {
    return `/${roleSlug}/pax-testing`;
  }
  if (primaryRole === "PACKING_OPERATOR" || primaryRole === "PACKING" || roleSlug === "packing-operator") {
    return `/${roleSlug}/packing`;
  }
  return `/${roleSlug}`;
}

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const user = req.auth?.user as any;
  const roles = (user?.roles as string[]) || [];

  const isApiRoute = nextUrl.pathname.startsWith("/api");
  const isUploadsRoute = nextUrl.pathname.startsWith("/public/uploads") || nextUrl.pathname.startsWith("/uploads");
  const isAuthRoute = nextUrl.pathname.startsWith("/login");
  const isPublicRoute = nextUrl.pathname === "/";

  // Allow all API routes & uploaded static assets
  if (isApiRoute || isUploadsRoute) return NextResponse.next();

  // If on login route:
  if (isAuthRoute) {
    const isExplicitLoginAccess = 
      nextUrl.searchParams.has("expired") ||
      nextUrl.searchParams.has("force") ||
      nextUrl.searchParams.has("reset") ||
      nextUrl.searchParams.has("logout");

    if (isLoggedIn && !isExplicitLoginAccess) {
      const dest = roles.length > 0 ? getRoleRedirect(roles) : "/dashboard";
      return NextResponse.redirect(new URL(dest, nextUrl));
    }
    // Allow unauthenticated users or users with expired sessions to view login page
    return NextResponse.next();
  }

  // If on root route:
  if (isPublicRoute) {
    if (isLoggedIn) {
      const dest = roles.length > 0 ? getRoleRedirect(roles) : "/dashboard";
      return NextResponse.redirect(new URL(dest, nextUrl));
    }
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // If not logged in and accessing any protected route, send to /login
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // If logged in and visiting /dashboard, route directly to role dashboard
  if (nextUrl.pathname === "/dashboard" || nextUrl.pathname === "/dashboard/") {
    if (roles.length > 0) {
      return NextResponse.redirect(new URL(getRoleRedirect(roles), nextUrl));
    }
  }

  // Role-based protection
  if (isLoggedIn && roles.length > 0) {
    if (nextUrl.pathname === "/pax-test-engineer" || nextUrl.pathname === "/pax-test-engineer/") {
      return NextResponse.redirect(new URL("/pax-test-engineer/pax-testing", nextUrl));
    }

    if (nextUrl.pathname === "/packing-operator" || nextUrl.pathname === "/packing-operator/") {
      return NextResponse.redirect(new URL("/packing-operator/packing", nextUrl));
    }

    const fallbackUrl = getRoleRedirect(roles);

    if (nextUrl.pathname.startsWith("/admin") && !roles.includes("ADMIN") && !roles.includes("SUPERADMIN")) {
      return NextResponse.redirect(new URL(fallbackUrl, nextUrl));
    }

    if (nextUrl.pathname.startsWith("/inventory") && !roles.includes("INVENTORY_MANAGER") && !roles.includes("ADMIN") && !roles.includes("SUPERADMIN")) {
      return NextResponse.redirect(new URL(fallbackUrl, nextUrl));
    }

    if (nextUrl.pathname.startsWith("/testing") && !roles.includes("TEST_ENGINEER") && !roles.includes("TESTER") && !roles.includes("ADMIN") && !roles.includes("SUPERADMIN")) {
      return NextResponse.redirect(new URL(fallbackUrl, nextUrl));
    }

    if ((nextUrl.pathname === "/inward" || nextUrl.pathname.endsWith("/inward") || nextUrl.pathname.includes("/inward/")) && !roles.includes("INVENTORY_MANAGER") && !roles.includes("ADMIN") && !roles.includes("SUPERADMIN")) {
      return NextResponse.redirect(new URL(fallbackUrl, nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|public/uploads|uploads|favicon.ico).*)"],
};
