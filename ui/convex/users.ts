import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Tier limits (messages per 30-day period)
const TIER_LIMITS: Record<string, number> = {
  free: 3,
  pro: 1000,
  business: 5000,
};

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
  },
});

export const getOrCreate = mutation({
  args: { email: v.string(), name: v.string() },
  handler: async (ctx, { email, name }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing) return existing;
    const id = await ctx.db.insert("users", {
      email,
      name,
      plan: "free",
      messageCount: 0,
      periodStart: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
    return ctx.db.get(id);
  },
});

export const getSubscription = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!user) return { tier: "free", messageCount: 0, limit: TIER_LIMITS.free, periodStart: new Date().toISOString() };

    const tier = user.plan ?? "free";
    const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
    const msgCount = user.messageCount ?? 0;
    const pStart = user.periodStart ?? new Date().toISOString();

    const daysSincePeriodStart = (Date.now() - new Date(pStart).getTime()) / (1000 * 60 * 60 * 24);

    return {
      tier,
      messageCount: daysSincePeriodStart >= 30 ? 0 : msgCount,
      limit,
      periodStart: pStart,
    };
  },
});

// Check if user can send a message + deduct
export const useMessage = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!user) return { allowed: false, remaining: 0 };

    const tier = user.plan ?? "free";
    const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
    const pStart = user.periodStart ?? new Date().toISOString();

    const daysSincePeriodStart = (Date.now() - new Date(pStart).getTime()) / (1000 * 60 * 60 * 24);

    let currentCount = user.messageCount ?? 0;
    if (daysSincePeriodStart >= 30) {
      currentCount = 0;
      await ctx.db.patch(user._id, {
        messageCount: 0,
        periodStart: new Date().toISOString(),
      });
    }

    if (currentCount >= limit) {
      return { allowed: false, remaining: 0 };
    }

    await ctx.db.patch(user._id, { messageCount: currentCount + 1 });
    return { allowed: true, remaining: limit - currentCount - 1 };
  },
});

// Set tier (called from Whop webhook)
export const setTier = mutation({
  args: {
    email: v.string(),
    tier: v.string(),
    whopMembershipId: v.optional(v.string()),
  },
  handler: async (ctx, { email, tier, whopMembershipId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!user) return false;

    const patch: Record<string, unknown> = { plan: tier };
    if (whopMembershipId !== undefined) patch.whopMembershipId = whopMembershipId;
    // Reset usage on upgrade
    if (tier !== user.plan) {
      patch.messageCount = 0;
      patch.periodStart = new Date().toISOString();
    }
    await ctx.db.patch(user._id, patch);
    return true;
  },
});

// Legacy aliases
export const setPlan = setTier;
export const getCredits = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!user) return 0;
    const tier = user.plan ?? "free";
    const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
    const pStart = user.periodStart ?? new Date().toISOString();
    const daysSincePeriodStart = (Date.now() - new Date(pStart).getTime()) / (1000 * 60 * 60 * 24);
    const currentCount = daysSincePeriodStart >= 30 ? 0 : (user.messageCount ?? 0);
    return limit - currentCount;
  },
});

export const updateCachedBalance = mutation({
  args: { email: v.string(), balance: v.number() },
  handler: async (ctx, { email, balance }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!user) return false;
    await ctx.db.patch(user._id, { cachedBalance: balance });
    return true;
  },
});
