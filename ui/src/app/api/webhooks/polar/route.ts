import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@/lib/convex-api";
import { getPolarBalance } from "@/lib/polar";

const SUBSCRIPTION_PRODUCTS: Record<string, "pro" | "business"> = {
  [process.env.NEXT_PUBLIC_POLAR_PRODUCT_PRO || ""]: "pro",
  [process.env.NEXT_PUBLIC_POLAR_PRODUCT_BUSINESS || ""]: "business",
};

export async function POST(req: Request) {
  const body = await req.text();
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("POLAR_WEBHOOK_SECRET not set");
    return Response.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event;
  try {
    event = validateEvent(body, Object.fromEntries(req.headers), webhookSecret);
  } catch (e) {
    if (e instanceof WebhookVerificationError) {
      console.error("Webhook verification failed:", e.message);
      return Response.json({ error: "Invalid signature" }, { status: 403 });
    }
    throw e;
  }

  const convex = getConvexClient();
  if (!convex) {
    return Response.json({ error: "Convex not configured" }, { status: 500 });
  }

  // Sync Polar balance into Convex cache
  async function syncBalance(email: string) {
    const data = await getPolarBalance(email);
    if (data) {
      await convex!.mutation(api.users.updateCachedBalance, {
        email,
        balance: data.balance,
      });
    }
  }

  // Subscription activated — upgrade plan + sync balance
  if (event.type === "subscription.created" || event.type === "subscription.active") {
    const sub = event.data;
    const email = sub.customer?.email;
    const productId = sub.product?.id;

    if (!email || !productId) {
      return Response.json({ received: true, skipped: "missing data" });
    }

    const plan = SUBSCRIPTION_PRODUCTS[productId];
    if (plan) {
      await convex.mutation(api.users.setPlan, {
        email,
        plan,
        polarCustomerId: sub.customerId,
      });
    }

    await syncBalance(email);
    console.log(`Subscription ${event.type} for ${email}, plan=${plan || "free"}`);
    return Response.json({ received: true, plan: plan || "free" });
  }

  // Subscription canceled — downgrade to free
  if (event.type === "subscription.canceled" || event.type === "subscription.revoked") {
    const sub = event.data;
    const email = sub.customer?.email;

    if (email) {
      await convex.mutation(api.users.setPlan, { email, plan: "free" });
      await syncBalance(email);
      console.log(`Downgraded ${email} to free`);
    }

    return Response.json({ received: true, plan: "free" });
  }

  // Order completed — sync balance (Polar Credit Benefit already granted credits)
  if (event.type === "order.created" || event.type === "order.paid") {
    const email = event.data.customer?.email;
    if (email) {
      await syncBalance(email);
      console.log(`Synced balance for ${email} after order`);
    }
    return Response.json({ received: true });
  }

  // Benefit granted/cycled — credits were added by Polar, sync balance
  if (event.type === "benefit_grant.created" || event.type === "benefit_grant.cycled") {
    const email = event.data.customer?.email;
    if (email) {
      await syncBalance(email);
      console.log(`Synced balance for ${email} after benefit grant`);
    }
    return Response.json({ received: true });
  }

  return Response.json({ received: true });
}
