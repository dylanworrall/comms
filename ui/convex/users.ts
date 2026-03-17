import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

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
  args: {
    email: v.string(),
    name: v.string(),
    polarCustomerId: v.optional(v.string()),
  },
  handler: async (ctx, { email, name, polarCustomerId }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing) return existing;
    const id = await ctx.db.insert("users", {
      email,
      name,
      plan: "free",
      cachedBalance: 0,
      polarCustomerId,
      createdAt: new Date().toISOString(),
    });
    return ctx.db.get(id);
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

export const decrementCachedBalance = mutation({
  args: { email: v.string(), amount: v.number() },
  handler: async (ctx, { email, amount }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!user) return;
    await ctx.db.patch(user._id, {
      cachedBalance: Math.max(0, (user.cachedBalance ?? 0) - amount),
    });
  },
});

export const setPlan = mutation({
  args: {
    email: v.string(),
    plan: v.union(v.literal("free"), v.literal("pro"), v.literal("business")),
    polarCustomerId: v.optional(v.string()),
  },
  handler: async (ctx, { email, plan, polarCustomerId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!user) return false;
    const updates: Record<string, unknown> = { plan };
    if (polarCustomerId !== undefined) updates.polarCustomerId = polarCustomerId;
    await ctx.db.patch(user._id, updates);
    return true;
  },
});
