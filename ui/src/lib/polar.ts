import { Polar } from "@polar-sh/sdk";

let polarInstance: Polar | null = null;

export function getPolar(): Polar {
  if (!polarInstance) {
    const accessToken = process.env.POLAR_ACCESS_TOKEN;
    if (!accessToken) throw new Error("POLAR_ACCESS_TOKEN not set");
    polarInstance = new Polar({ accessToken });
  }
  return polarInstance;
}

/** Ingest a usage event for the "AI Messages" meter */
export async function ingestUsageEvent(
  externalCustomerId: string,
  units: number = 1
): Promise<void> {
  const polar = getPolar();
  await polar.events.ingest({
    events: [
      {
        name: "ai_messages",
        externalCustomerId,
        metadata: { units },
      },
    ],
  });
}

/** Get credit balance from Polar via customer state */
export async function getPolarBalance(
  externalCustomerId: string
): Promise<{ balance: number; plan: string; consumedUnits: number; creditedUnits: number } | null> {
  const polar = getPolar();
  const meterId = process.env.POLAR_METER_ID;
  try {
    const state = await polar.customers.getStateExternal({ externalId: externalCustomerId });
    const meter = meterId
      ? state.activeMeters.find((m: { meterId: string }) => m.meterId === meterId)
      : state.activeMeters[0];
    const sub = state.activeSubscriptions[0];
    const plan = sub ? mapProductToPlan(sub.productId) : "free";
    return {
      balance: meter?.balance ?? 0,
      plan,
      consumedUnits: meter?.consumedUnits ?? 0,
      creditedUnits: meter?.creditedUnits ?? 0,
    };
  } catch {
    return null;
  }
}

/** Create a Polar customer with email as external ID */
export async function createPolarCustomer(
  email: string,
  name: string
): Promise<string> {
  const polar = getPolar();
  const customer = await polar.customers.create({
    email,
    name,
    externalId: email,
  });
  return customer.id;
}

function mapProductToPlan(productId: string): "free" | "pro" | "business" {
  if (productId === process.env.NEXT_PUBLIC_POLAR_PRODUCT_PRO) return "pro";
  if (productId === process.env.NEXT_PUBLIC_POLAR_PRODUCT_BUSINESS) return "business";
  return "free";
}
