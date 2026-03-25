import { z } from "zod";

export const processEmailsTool = {
  name: "process_emails",
  description:
    "Trigger AI processing on unprocessed inbox emails. This auto-tags, classifies sender type (human vs auto), generates summaries, and scores priority. Must be enabled in AI settings first.",
  inputSchema: z.object({}),
  execute: async () => {
    const { getAISettings } = await import("@/lib/stores/ai-settings-store");
    const settings = getAISettings();
    if (!settings.enabled) {
      return { error: "AI email processing is disabled. Enable it in Settings > AI Automations." };
    }
    // Use internal import to call the processing logic directly
    const { getAllEmails, updateEmailAI } = await import("@/lib/stores/inbox-store");
    const { isProcessed, addProcessedId } = await import("@/lib/stores/ai-settings-store");
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    const { generateObject } = await import("ai");

    const allEmails = getAllEmails();
    const unprocessed = allEmails.filter((e) => e.folder === "inbox" && !isProcessed(e.id));

    if (unprocessed.length === 0) {
      return { message: "All inbox emails are already processed", processed: 0 };
    }

    const { loadCommsEnv } = await import("@/lib/env");
    loadCommsEnv(true);

    const apiKey = process.env.CLAUDE_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { error: "No API key configured" };

    const anthropic = createAnthropic({ apiKey });
    const tagList = settings.tags.map((t) => `"${t.name}" (${t.points > 0 ? "+" : ""}${t.points}pts)`).join(", ");

    const batch = unprocessed.slice(0, 10);
    const emailSummaries = batch.map((e, idx) => {
      return `--- Email ${idx + 1} (id: ${e.id}) ---\nFrom: ${e.fromName} <${e.from}>\nDomain Type: ${e.domainType ?? "unknown"}\nSubject: ${e.subject}\nBody: ${(e.body || "").slice(0, 400)}`;
    }).join("\n\n");

    const result = await generateObject({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt: `Analyze these emails. Available tags: ${tagList}\n\nDomain types are pre-classified: "personal" = free email (@gmail.com, @yahoo.com, etc.), "business" = custom company domain. Business emails should generally score higher priority.\n\n${settings.systemPrompt}\n\n${emailSummaries}`,
      schema: z.object({
        results: z.array(z.object({
          emailId: z.string(),
          tags: z.array(z.string()),
          senderType: z.enum(["human", "auto"]),
          aiSummary: z.string(),
          priority: z.number(),
          aiDraftReply: z.string().optional(),
        })),
      }),
    });

    let processed = 0;
    for (const r of result.object.results) {
      if (batch.find((e) => e.id === r.emailId)) {
        updateEmailAI(r.emailId, {
          tags: r.tags,
          priority: r.priority,
          senderType: r.senderType,
          aiSummary: r.aiSummary,
          aiDraftReply: r.aiDraftReply,
        });
        addProcessedId(r.emailId);
        processed++;
      }
    }

    return { message: `Processed ${processed} emails`, processed, remaining: unprocessed.length - processed };
  },
};

export const getPriorityEmailsTool = {
  name: "get_priority_emails",
  description: "Get emails sorted by AI priority score (highest first). Use this when the user asks what's important, wants a triage, or asks about priority emails.",
  inputSchema: z.object({
    minPriority: z.number().optional().describe("Minimum priority score to include"),
    limit: z.number().optional().default(10).describe("Max results"),
  }),
  execute: async ({ minPriority, limit }: { minPriority?: number; limit?: number }) => {
    const { getEmails } = await import("@/lib/stores/inbox-store");
    let emails = getEmails({ folder: "inbox", sortBy: "priority" });
    if (minPriority != null) emails = emails.filter((e) => (e.priority ?? 0) >= minPriority);
    return {
      emails: emails.slice(0, limit ?? 10).map((e) => ({
        id: e.id,
        from: e.fromName,
        email: e.from,
        subject: e.subject,
        priority: e.priority ?? 0,
        tags: e.tags ?? [],
        aiSummary: e.aiSummary,
        senderType: e.senderType,
        domainType: e.domainType,
        read: e.read,
        timestamp: e.timestamp,
        gmailMessageId: e.gmailMessageId,
      })),
    };
  },
};

export const summarizeInboxTool = {
  name: "summarize_inbox",
  description: "Provide a high-level summary of the inbox: total emails, unread count, top priority items, sender breakdown (human vs auto), and tag distribution.",
  inputSchema: z.object({}),
  execute: async () => {
    const { getAllEmails } = await import("@/lib/stores/inbox-store");
    const emails = getAllEmails().filter((e) => e.folder === "inbox");
    const unread = emails.filter((e) => !e.read).length;
    const human = emails.filter((e) => e.senderType === "human").length;
    const auto = emails.filter((e) => e.senderType === "auto").length;
    const unclassified = emails.length - human - auto;

    const tagCounts: Record<string, number> = {};
    for (const e of emails) {
      for (const t of e.tags ?? []) {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      }
    }

    const topPriority = emails
      .filter((e) => (e.priority ?? 0) > 0)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      .slice(0, 5)
      .map((e) => ({ from: e.fromName, subject: e.subject, priority: e.priority, tags: e.tags }));

    return {
      total: emails.length,
      unread,
      senders: { human, auto, unclassified },
      tagCounts,
      topPriority,
    };
  },
};
