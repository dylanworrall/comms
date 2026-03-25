import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { allTools } from "@/lib/ai/tools";
import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { loadCommsEnv } from "@/lib/env";
import { getConvexClient, isConvexMode } from "@/lib/convex-server";
import { api } from "@/lib/convex-api";
import { ingestUsageEvent, getPolarBalance } from "@/lib/polar";
import { requireAuth } from "@/lib/api-auth";

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;
  loadCommsEnv(true);

  const body = await req.json();
  const { messages } = body;

  const CREDITS_PER_MESSAGE = 1;
  const userEmail = body.userEmail as string | undefined;

  if (isConvexMode()) {
    if (!userEmail) {
      return Response.json(
        { error: "Authentication required. Please sign in." },
        { status: 401 }
      );
    }

    // Fast check: cached balance in Convex
    const convex = getConvexClient();
    let hasCredits = false;
    if (convex) {
      const user = await convex.query(api.users.getByEmail, { email: userEmail });
      if (user && (user.cachedBalance ?? 0) >= CREDITS_PER_MESSAGE) {
        hasCredits = true;
      }
    }

    // Fallback: live Polar check if cache says insufficient
    if (!hasCredits) {
      const polarBalance = await getPolarBalance(userEmail);
      if (!polarBalance || polarBalance.balance < CREDITS_PER_MESSAGE) {
        return Response.json(
          { error: "Insufficient credits. Purchase more or upgrade your plan." },
          { status: 402 }
        );
      }
      // Update cache with fresh data
      if (convex) {
        await convex.mutation(api.users.updateCachedBalance, {
          email: userEmail,
          balance: polarBalance.balance,
        });
      }
    }

    // Optimistically decrement cache + ingest to Polar (fire-and-forget)
    if (convex) {
      convex.mutation(api.users.decrementCachedBalance, {
        email: userEmail,
        amount: CREDITS_PER_MESSAGE,
      }).catch(() => {});
    }
    ingestUsageEvent(userEmail, CREDITS_PER_MESSAGE).catch((err) =>
      console.error("Polar ingest error:", err)
    );
  }

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "No API key configured. Go to /login to set up." },
      { status: 400 }
    );
  }

  const google = createGoogleGenerativeAI({ apiKey });
  const modelId = (body.model as string) || "gemini-2.5-flash";

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: google(modelId),
    system: SYSTEM_PROMPT,
    messages: modelMessages,
    tools: allTools,
    stopWhen: stepCountIs(10),
  });

  return result.toUIMessageStreamResponse();
}
