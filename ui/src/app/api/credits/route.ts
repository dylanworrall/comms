import { NextRequest, NextResponse } from "next/server";
import { getConvexClient, isConvexMode } from "@/lib/convex-server";
import { api } from "@/lib/convex-api";
import { getPolarBalance, createPolarCustomer } from "@/lib/polar";

export async function GET(req: NextRequest) {
  if (!isConvexMode()) {
    return NextResponse.json({ credits: Infinity, mode: "local", plan: "local" });
  }

  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  // Try Polar for live data
  const polarData = await getPolarBalance(email);
  if (polarData) {
    // Update Convex cache opportunistically
    const convex = getConvexClient();
    if (convex) {
      convex.mutation(api.users.updateCachedBalance, {
        email,
        balance: polarData.balance,
      }).catch(() => {});
    }

    return NextResponse.json({
      plan: polarData.plan,
      available: polarData.balance,
      consumed: polarData.consumedUnits,
      credited: polarData.creditedUnits,
      mode: "cloud",
    });
  }

  // Fallback: Convex cached data
  const convex = getConvexClient();
  if (!convex) return NextResponse.json({ credits: Infinity, mode: "local", plan: "local" });

  const user = await convex.query(api.users.getByEmail, { email });
  return NextResponse.json({
    plan: user?.plan ?? "free",
    available: user?.cachedBalance ?? 0,
    consumed: 0,
    credited: 0,
    mode: "cloud",
  });
}

export async function POST(req: NextRequest) {
  if (!isConvexMode()) return NextResponse.json({ ok: true, mode: "local" });

  const { email, name } = await req.json();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const convex = getConvexClient();
  if (!convex) return NextResponse.json({ ok: true, mode: "local" });

  // Create Polar customer (idempotent — 422 if already exists)
  let polarCustomerId: string | undefined;
  try {
    polarCustomerId = await createPolarCustomer(email, name || email.split("@")[0]);
  } catch {
    // Customer may already exist in Polar, that's fine
  }

  const user = await convex.mutation(api.users.getOrCreate, {
    email,
    name: name || email.split("@")[0],
    polarCustomerId,
  });

  return NextResponse.json({ ok: true, user });
}
