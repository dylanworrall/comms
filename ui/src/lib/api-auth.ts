import { NextResponse } from "next/server";

const isCloudMode = !!process.env.NEXT_PUBLIC_CONVEX_URL;

/**
 * Returns null if the request is authorized, or a 401 Response if not.
 * In local mode (no NEXT_PUBLIC_CONVEX_URL), always passes through.
 */
export async function requireAuth(): Promise<NextResponse | null> {
  if (!isCloudMode) return null;

  // Dynamic import to avoid pulling in BetterAuth in local mode
  const { isAuthenticated } = await import("@/lib/auth-server");
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  return null;
}

/**
 * Returns true if this is a managed deployment (operator-set keys, no user key management).
 */
export function isManaged(): boolean {
  return process.env.NEXT_PUBLIC_COMMS_MANAGED === "true";
}
