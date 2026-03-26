import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth",        // BetterAuth handler + key management (has its own guards)
  "/api/webhooks",    // Polar webhooks (signature-verified)
  "/api/twilio/webhook", // Twilio voice webhooks (server-to-server)
  "/api/twilio/sms-webhook", // Twilio SMS webhooks (server-to-server)
  "/api/gmail/callback", // Google OAuth callback
];

export function middleware(request: NextRequest) {
  // Local mode (no Convex URL) = no auth required
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

  // Unauthenticated requests
  if (!sessionToken) {
    // API routes get 401 JSON, not a redirect
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    // Page routes redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
