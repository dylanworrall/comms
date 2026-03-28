import { addSms } from "@/lib/stores/sms-store";
import { addActivity } from "@/lib/stores/activity";
import { getSmsAgentConfig, buildSmsPrompt } from "@/lib/stores/sms-agent-store";
import { getSmsConversation } from "@/lib/stores/sms-store";

export async function POST(req: Request) {
  const formData = await req.formData();

  const from = String(formData.get("From") || "");
  const to = String(formData.get("To") || "");
  const body = String(formData.get("Body") || "").trim();
  const messageSid = String(formData.get("MessageSid") || "");

  if (!from || !body) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
    return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
  }

  // Store inbound message
  addSms({
    from, to, body,
    direction: "inbound",
    status: "received",
    timestamp: new Date().toISOString(),
    twilioSid: messageSid || undefined,
  });

  addActivity(
    "sms_received",
    `SMS from ${from}: ${body.slice(0, 80)}${body.length > 80 ? "..." : ""}`,
    { from, messageSid }
  );

  // Check for opt-out keywords
  const lower = body.toLowerCase();
  if (["stop", "cancel", "unsubscribe", "end", "quit"].includes(lower)) {
    const config = getSmsAgentConfig();
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(config.optOutMessage)}</Message></Response>`;
    return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
  }

  // Auto-reply if enabled
  const config = getSmsAgentConfig();
  if (config.autoReply) {
    // Check working hours
    if (config.workingHours.enabled) {
      const now = new Date();
      const hour = now.getHours(); // TODO: proper timezone conversion
      const day = now.getDay();
      if (!config.workingHours.daysOfWeek.includes(day) || hour < config.workingHours.startHour || hour >= config.workingHours.endHour) {
        if (config.workingHours.outsideHoursMessage) {
          const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(config.workingHours.outsideHoursMessage)}</Message></Response>`;
          addSms({ from: to, to: from, body: config.workingHours.outsideHoursMessage, direction: "outbound", status: "sent", timestamp: new Date().toISOString() });
          return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
        }
        const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
        return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
      }
    }

    // Generate AI reply
    try {
      const { loadCommsEnv } = await import("@/lib/env");
      loadCommsEnv(true);

      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (apiKey) {
        const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
        const { generateText } = await import("ai");
        const google = createGoogleGenerativeAI({ apiKey });

        // Build conversation context
        const history = getSmsConversation(from).slice(-10);
        const conversationContext = history.map((m) =>
          `${m.direction === "inbound" ? "Them" : "You"}: ${m.body}`
        ).join("\n");

        const systemPrompt = buildSmsPrompt(config);
        const prompt = `${systemPrompt}

CONVERSATION SO FAR:
${conversationContext}
Them: ${body}

Reply with a SHORT text message (1-3 sentences max). Just the message text, nothing else.`;

        const result = await generateText({
          model: google("gemini-2.5-flash"),
          prompt,
        });

        const reply = result.text.trim();
        if (reply) {
          const sig = config.signature ? `\n${config.signature}` : "";
          const fullReply = reply + sig;

          addSms({ from: to, to: from, body: fullReply, direction: "outbound", status: "sent", timestamp: new Date().toISOString() });

          const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(fullReply)}</Message></Response>`;
          return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
        }
      }
    } catch (err) {
      console.error("[SMS auto-reply] AI generation failed:", err);
    }
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
