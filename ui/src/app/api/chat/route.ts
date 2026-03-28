import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { allTools } from "@/lib/ai/tools";
import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { loadCommsEnv } from "@/lib/env";
import { getConvexClient, isConvexMode } from "@/lib/convex-server";
import { api } from "@/lib/convex-api";
import { requireAuth } from "@/lib/api-auth";

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;
  loadCommsEnv(true);

  const body = await req.json();
  const { messages } = body;
  const userEmail = body.userEmail as string | undefined;

  // Usage check in cloud mode
  if (isConvexMode() && userEmail) {
    const convex = getConvexClient();
    if (convex) {
      try {
        const result = await convex.mutation(api.users.useMessage, { email: userEmail });
        if (!result.allowed) {
          return Response.json(
            { error: "You've used all 3 free messages. Upgrade to Pro for 1,000 messages/month.", code: "LIMIT_REACHED" },
            { status: 402 }
          );
        }
      } catch (err) {
        // Best-effort — don't block on billing failure
        console.warn("Usage check failed:", err);
      }
    }
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
