import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  contacts: defineTable({
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    company: v.optional(v.string()),
    tags: v.array(v.string()),
    notes: v.optional(v.string()),
    lastContacted: v.optional(v.string()),
    avatar: v.optional(v.string()),
    updatedAt: v.string(),
  })
    .index("by_email", ["email"])
    .searchIndex("search_contacts", {
      searchField: "name",
      filterFields: ["email", "company", "tags"],
    }),

  emails: defineTable({
    from: v.string(),
    fromName: v.string(),
    to: v.string(),
    cc: v.optional(v.string()),
    subject: v.string(),
    body: v.string(),
    preview: v.string(),
    timestamp: v.string(),
    read: v.boolean(),
    flagged: v.boolean(),
    folder: v.union(
      v.literal("inbox"),
      v.literal("sent"),
      v.literal("drafts"),
      v.literal("trash")
    ),
    threadId: v.optional(v.string()),
  })
    .index("by_folder", ["folder"])
    .index("by_timestamp", ["timestamp"])
    .index("by_threadId", ["threadId"]),

  calls: defineTable({
    contactId: v.optional(v.string()),
    contactName: v.string(),
    phoneNumber: v.string(),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    status: v.union(
      v.literal("completed"),
      v.literal("missed"),
      v.literal("voicemail")
    ),
    duration: v.number(),
    timestamp: v.string(),
    transcript: v.optional(v.string()),
    notes: v.optional(v.string()),
  }).index("by_timestamp", ["timestamp"]),

  chatThreads: defineTable({
    title: v.string(),
    lastMessage: v.string(),
    updatedAt: v.string(),
  }).index("by_updatedAt", ["updatedAt"]),

  chatMessages: defineTable({
    threadId: v.id("chatThreads"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    timestamp: v.string(),
  }).index("by_thread", ["threadId", "timestamp"]),

  spaces: defineTable({
    name: v.string(),
    description: v.string(),
    tone: v.string(),
    defaultRecipients: v.array(v.string()),
    emailSignature: v.string(),
    templates: v.array(
      v.object({
        name: v.string(),
        subject: v.string(),
        body: v.string(),
      })
    ),
    autoApprove: v.array(v.string()),
    updatedAt: v.string(),
  }),

  approvals: defineTable({
    type: v.union(
      v.literal("send_email"),
      v.literal("reply_to_email"),
      v.literal("initiate_call"),
      v.literal("add_contact"),
      v.literal("update_contact")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected")
    ),
    data: v.any(),
    resolvedAt: v.optional(v.string()),
  }).index("by_status", ["status"]),

  activity: defineTable({
    type: v.union(
      v.literal("email_sent"),
      v.literal("email_received"),
      v.literal("contact_added"),
      v.literal("approval_resolved")
    ),
    summary: v.string(),
    metadata: v.optional(v.any()),
  }),

  settings: defineTable({
    key: v.literal("global"),
    agentModes: v.any(),
    fromEmail: v.string(),
    anthropicModel: v.string(),
    temperature: v.number(),
    voiceProvider: v.optional(v.string()),
    voiceApiKey: v.optional(v.string()),
    notificationsEnabled: v.boolean(),
  }).index("by_key", ["key"]),

  users: defineTable({
    email: v.string(),
    name: v.string(),
    plan: v.optional(v.union(v.literal("free"), v.literal("pro"), v.literal("business"))),
    cachedBalance: v.optional(v.number()),
    polarCustomerId: v.optional(v.string()),
    // Legacy fields (ignored, kept for backwards compat with existing docs)
    credits: v.optional(v.number()),
    includedCredits: v.optional(v.number()),
    includedCreditsUsed: v.optional(v.number()),
    overageCredits: v.optional(v.number()),
    currentPeriodStart: v.optional(v.string()),
    polarSubscriptionId: v.optional(v.string()),
    createdAt: v.string(),
  }).index("by_email", ["email"]),
});
