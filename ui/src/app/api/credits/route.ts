import { NextRequest, NextResponse } from "next/server";
import { getConvexClient, isConvexMode } from "@/lib/convex-server";
import { api } from "@/lib/convex-api";
import { requireAuth } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  if (!isConvexMode()) {
    return NextResponse.json({ tier: "local", messageCount: 0, limit: Infinity, mode: "local", credits: Infinity });
  }

  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const convex = getConvexClient();
  if (!convex) return NextResponse.json({ tier: "local", messageCount: 0, limit: Infinity, mode: "local", credits: Infinity });

  const sub = await convex.query(api.users.getSubscription, { email });
  return NextResponse.json({
    ...sub,
    credits: sub.limit - sub.messageCount, // backwards compat
    mode: "cloud",
  });
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  if (!isConvexMode()) return NextResponse.json({ ok: true, mode: "local" });

  const { email, name } = await req.json();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const convex = getConvexClient();
  if (!convex) return NextResponse.json({ ok: true, mode: "local" });

  const user = await convex.mutation(api.users.getOrCreate, {
    email,
    name: name || email.split("@")[0],
  });

  return NextResponse.json({ ok: true, user });
}
