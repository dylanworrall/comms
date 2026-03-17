import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth", "/api/webhooks"];

export default function proxy(request: NextRequest) {
  // Local mode (no Convex URL) = free, no auth required
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Check for BetterAuth session cookie
  const sessionToken =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");

  // Redirect authenticated users away from /login
  if (pathname === "/login" && sessionToken) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Allow public paths and static assets
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
