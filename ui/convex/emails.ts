import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: {
    folder: v.optional(v.union(v.literal("inbox"), v.literal("sent"), v.literal("drafts"), v.literal("trash"))),
    unreadOnly: v.optional(v.boolean()),
    flagged: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let emails = await ctx.db.query("emails").order("desc").collect();

    if (args.folder) emails = emails.filter((e) => e.folder === args.folder);
    if (args.unreadOnly) emails = emails.filter((e) => !e.read);
    if (args.flagged) emails = emails.filter((e) => e.flagged);

    emails.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (args.limit) return emails.slice(0, args.limit);
    return emails;
  },
});

export const getById = query({
  args: { id: v.id("emails") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const unreadCount = query({
  handler: async (ctx) => {
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_folder", (q) => q.eq("folder", "inbox"))
      .collect();
    return emails.filter((e) => !e.read).length;
  },
});

export const add = mutation({
  args: {
    from: v.string(),
    fromName: v.string(),
    to: v.string(),
    cc: v.optional(v.string()),
    subject: v.string(),
    body: v.string(),
    timestamp: v.string(),
    read: v.boolean(),
    flagged: v.boolean(),
    folder: v.union(v.literal("inbox"), v.literal("sent"), v.literal("drafts"), v.literal("trash")),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const preview = args.body.replace(/\n/g, " ").slice(0, 120);
    return await ctx.db.insert("emails", { ...args, preview });
  },
});

export const markRead = mutation({
  args: { id: v.id("emails") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { read: true });
    return await ctx.db.get(args.id);
  },
});

export const toggleFlag = mutation({
  args: { id: v.id("emails") },
  handler: async (ctx, args) => {
    const email = await ctx.db.get(args.id);
    if (!email) return null;
    await ctx.db.patch(args.id, { flagged: !email.flagged });
    return await ctx.db.get(args.id);
  },
});

export const moveToFolder = mutation({
  args: {
    id: v.id("emails"),
    folder: v.union(v.literal("inbox"), v.literal("sent"), v.literal("drafts"), v.literal("trash")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { folder: args.folder });
    return await ctx.db.get(args.id);
  },
});

export const remove = mutation({
  args: { id: v.id("emails") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const seed = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db.query("emails").first();
    if (existing) return;

    const seeds = [
      { from: "sarah.chen@acmecorp.com", fromName: "Sarah Chen", to: "you@example.com", subject: "Q2 Strategy Meeting — Thursday 2pm", body: "Hi there,\n\nI wanted to confirm our Q2 strategy meeting for this Thursday at 2pm.\n\nBest,\nSarah", preview: "Hi there, I wanted to confirm our Q2 strategy meeting for this Thursday at 2pm.", timestamp: "2026-03-05T09:15:00.000Z", read: false, flagged: false, folder: "inbox" as const, threadId: "thread-q2-strategy" },
      { from: "james.wright@venturelabs.io", fromName: "James Wright", to: "you@example.com", subject: "Proposal: AI Integration Services", body: "Hello,\n\nI've put together a proposal for AI integration services.\n\nTotal estimate: $45,000 over 3 months.\n\nRegards,\nJames", preview: "Hello, I've put together a proposal for AI integration services.", timestamp: "2026-03-04T16:42:00.000Z", read: false, flagged: true, folder: "inbox" as const },
      { from: "maya.patel@designhub.co", fromName: "Maya Patel", to: "you@example.com", cc: "team@example.com", subject: "Introduction — New Design Lead", body: "Hi everyone,\n\nI'm Maya, the new design lead joining Monday.\n\nWarm regards,\nMaya", preview: "Hi everyone, I'm Maya, the new design lead joining Monday.", timestamp: "2026-03-04T11:20:00.000Z", read: true, flagged: false, folder: "inbox" as const },
    ];

    for (const s of seeds) {
      await ctx.db.insert("emails", s);
    }
  },
});
