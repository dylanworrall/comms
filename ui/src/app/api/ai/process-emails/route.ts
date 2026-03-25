import { NextResponse } from "next/server";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { loadCommsEnv } from "@/lib/env";
import {
  getAISettings,
  addProcessedId,
  isProcessed,
} from "@/lib/stores/ai-settings-store";
import { getAllEmails, updateEmailAI } from "@/lib/stores/inbox-store";
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

  const apiKey = process.env.CLAUDE_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "No API key configured for AI processing" },
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

  const anthropic = createAnthropic({
    apiKey,
  });

  const tagList = settings.tags
    .map((t) => `"${t.name}" (${t.points > 0 ? "+" : ""}${t.points} points)`)
    .join(", ");

  let totalProcessed = 0;

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
${settings.autoRespond ? "5. If the email warrants a response, draft a brief professional reply" : ""}

${settings.systemPrompt}

Emails to analyze:

${emailSummaries}`;

    try {
      const result = await generateObject({
        model: anthropic("claude-sonnet-4-20250514"),
        prompt,
        schema: z.object({
          results: z.array(
            z.object({
              emailId: z.string(),
              tags: z.array(z.string()),
              senderType: z.enum(["human", "auto"]),
              aiSummary: z.string(),
              priority: z.number(),
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
        });
        addProcessedId(email.id);
        totalProcessed++;
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
  });
}
