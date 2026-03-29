import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getCurrentUser } from "@/lib/api-auth";

const TIER_LIMITS: Record<string, number> = { free: 3, pro: 1000, business: 5000 };

export async function GET(req: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ tier: "free", messageCount: 0, limit: 3, mode: "cloud", credits: 3 });
  }

  const plan = user.plan || "free";
  const limit = TIER_LIMITS[plan] ?? 3;

  // Reset period if 30+ days
  let messageCount = user.messageCount ?? 0;
  const daysSince = (Date.now() - new Date(user.periodStart).getTime()) / 86400000;
  if (daysSince >= 30) messageCount = 0;

  return NextResponse.json({
    tier: plan,
    messageCount,
    limit,
    credits: limit - messageCount,
    mode: "cloud",
    periodStart: user.periodStart,
  });
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;
  return NextResponse.json({ ok: true });
}
