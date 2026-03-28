import { NextRequest, NextResponse } from "next/server";
import { getConvexClient, isConvexMode } from "@/lib/convex-server";
import { api } from "@/lib/convex-api";
import { getWhopSdk } from "@/lib/whop-sdk";

const PLAN_TIERS: Record<string, string> = {
  [process.env.NEXT_PUBLIC_WHOP_PLAN_PRO ?? ""]: "pro",
  [process.env.NEXT_PUBLIC_WHOP_PLAN_BUSINESS ?? ""]: "business",
};

export async function POST(req: NextRequest) {
  if (!isConvexMode()) {
    return NextResponse.json({ error: "Not in cloud mode" }, { status: 404 });
  }

  if (!process.env.WHOP_WEBHOOK_SECRET) {
    console.error("WHOP_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await req.text();
  const headers = Object.fromEntries(req.headers);

  let webhookData;
  try {
    webhookData = getWhopSdk().webhooks.unwrap(body, { headers });
  } catch (e) {
    console.error("Whop webhook signature verification failed:", e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const convex = getConvexClient();
  if (!convex) {
    return NextResponse.json({ error: "No Convex client" }, { status: 500 });
  }

  if (webhookData.type === "payment.succeeded") {
    const payment = webhookData.data;
    const email = payment.user?.email;
    const planId = payment.plan?.id;
    const membershipId = payment.membership?.id;

    if (email) {
      const tier = PLAN_TIERS[planId ?? ""];
      if (tier) {
        await convex.mutation(api.users.setTier, { email, tier, whopMembershipId: membershipId });
        console.log(`[Whop] ${email} upgraded to ${tier}`);
      }
    }
  }

  if (webhookData.type === "membership.deactivated") {
    const membership = webhookData.data;
    const email = membership.user?.email;
    if (email) {
      await convex.mutation(api.users.setTier, { email, tier: "free" });
      console.log(`[Whop] ${email} downgraded to free`);
    }
  }

  return NextResponse.json({ received: true });
}
