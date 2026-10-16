import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const user = req.auth?.user as any;

  const isApiRoute = nextUrl.pathname.startsWith("/api");
  const isAuthRoute = nextUrl.pathname.startsWith("/login");
  const isPublicRoute = nextUrl.pathname === "/";

  if (isApiRoute) return NextResponse.next();

  if (isAuthRoute) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Role-based protection
  if (isLoggedIn && user?.roles) {
    const roles = user.roles as string[];
    
    if (nextUrl.pathname === "/pax-test-engineer" || nextUrl.pathname === "/pax-test-engineer/") {
      return NextResponse.redirect(new URL("/pax-test-engineer/pax-testing", nextUrl));
    }

    if (nextUrl.pathname === "/packing-operator" || nextUrl.pathname === "/packing-operator/") {
      return NextResponse.redirect(new URL("/packing-operator/packing", nextUrl));
    }

    if (nextUrl.pathname.startsWith("/admin") && !roles.includes("ADMIN") && !roles.includes("SUPERADMIN")) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }

    if (nextUrl.pathname.startsWith("/inventory") && !roles.includes("INVENTORY_MANAGER") && !roles.includes("ADMIN") && !roles.includes("SUPERADMIN")) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }

    if (nextUrl.pathname.startsWith("/testing") && !roles.includes("TEST_ENGINEER") && !roles.includes("TESTER") && !roles.includes("ADMIN") && !roles.includes("SUPERADMIN")) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }

    if ((nextUrl.pathname === "/inward" || nextUrl.pathname.endsWith("/inward") || nextUrl.pathname.includes("/inward/")) && !roles.includes("INVENTORY_MANAGER") && !roles.includes("ADMIN") && !roles.includes("SUPERADMIN")) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
