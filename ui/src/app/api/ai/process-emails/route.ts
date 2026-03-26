import { NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { loadCommsEnv } from "@/lib/env";
import {
  getAISettings,
  addProcessedId,
  isProcessed,
} from "@/lib/stores/ai-settings-store";
import { getAllEmails, updateEmailAI, moveToFolder, markRead } from "@/lib/stores/inbox-store";
import { requireAuth } from "@/lib/api-auth";

const BATCH_SIZE = 10;

export async function POST() {
  const authError = await requireAuth();
  if (authError) return authError;
  loadCommsEnv(true);

  const settings = getAISettings();
  if (!settings.enabled) {
    return NextResponse.json({ message: "AI processing is disabled", processed: 0 });
  }

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "No GOOGLE_GENERATIVE_AI_API_KEY configured for AI processing" },
      { status: 500 }
    );
  }

  const allEmails = getAllEmails();
  const unprocessed = allEmails.filter(
    (e) => e.folder === "inbox" && !isProcessed(e.id)
  );

  if (unprocessed.length === 0) {
    return NextResponse.json({ message: "No unprocessed emails", processed: 0 });
  }

  const google = createGoogleGenerativeAI({ apiKey });

  const tagList = settings.tags
    .map((t) => `"${t.name}" (${t.points > 0 ? "+" : ""}${t.points} points)`)
    .join(", ");

  let totalProcessed = 0;
  const autopilotActions = { archived: 0, markedRead: 0 };

  // Process in batches
  for (let i = 0; i < unprocessed.length; i += BATCH_SIZE) {
    const batch = unprocessed.slice(i, i + BATCH_SIZE);

    const emailSummaries = batch.map((e, idx) => {
      const bodyPreview = (e.body || "").slice(0, 500);
      return `--- Email ${idx + 1} (id: ${e.id}) ---
From: ${e.fromName} <${e.from}>
To: ${e.to}
Subject: ${e.subject}
Body: ${bodyPreview}`;
    }).join("\n\n");

    const prompt = `You are an email triage AI. Analyze each email below and for each one determine:

1. Which tags apply from this list: ${tagList}
2. Is the sender a human or automated (newsletters, noreply, github notifications, marketing, etc.)
3. A concise one-line summary (max 80 chars)
4. Priority score = sum of points from matched tags (can be negative)
5. Category — classify into exactly one:
   - "primary": person-to-person messages, direct requests, time-sensitive items requiring action
   - "transactions": receipts, order confirmations, shipping notices, payment notifications, OTP codes
   - "updates": notifications from services (GitHub, Slack, Jira), social media updates, account alerts
   - "promotions": marketing emails, sales offers, coupons, product announcements
   - "newsletters": newsletter subscriptions, digests, RSS-style content, blog roundups
${settings.autoRespond ? "6. If the email warrants a response, draft a brief professional reply" : ""}

${settings.systemPrompt}

Emails to analyze:

${emailSummaries}`;

    try {
      const result = await generateObject({
        model: google("gemini-2.5-flash"),
        prompt,
        schema: z.object({
          results: z.array(
            z.object({
              emailId: z.string(),
              tags: z.array(z.string()),
              senderType: z.enum(["human", "auto"]),
              aiSummary: z.string(),
              priority: z.number(),
              category: z.enum(["primary", "transactions", "updates", "promotions", "newsletters"]),
              aiDraftReply: z.string().optional(),
            })
          ),
        }),
      });

      for (const r of result.object.results) {
        const email = batch.find((e) => e.id === r.emailId);
        if (!email) continue;

        updateEmailAI(email.id, {
          tags: r.tags,
          priority: r.priority,
          senderType: r.senderType,
          aiSummary: r.aiSummary,
          aiDraftReply: r.aiDraftReply,
          category: r.category,
        });
        addProcessedId(email.id);
        totalProcessed++;

        // ── Autopilot actions ──
        const autopilot = settings.autopilot;
        if (autopilot) {
          if (autopilot.archivePromotions && r.category === "promotions") {
            moveToFolder(email.id, "trash");
            autopilotActions.archived++;
          } else if (autopilot.archiveNewsletters && r.category === "newsletters") {
            moveToFolder(email.id, "trash");
            autopilotActions.archived++;
          }
          if (autopilot.autoMarkReadUpdates && r.category === "updates") {
            markRead(email.id);
            autopilotActions.markedRead++;
          }
        }
      }
    } catch (err) {
      console.error("AI processing batch failed:", err);
      // Continue with next batch rather than failing entirely
    }
  }

  return NextResponse.json({
    message: `Processed ${totalProcessed} email(s)`,
    processed: totalProcessed,
    remaining: unprocessed.length - totalProcessed,
    autopilot: autopilotActions,
  });
}
