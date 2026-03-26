import { z } from "zod";

export const sendSmsTool = {
  name: "send_sms",
  description: "Send an SMS text message to a phone number. The message is sent from the configured Twilio phone number.",
  inputSchema: z.object({
    to: z.string().describe("Phone number to send to (E.164 format, e.g. +14155551234)"),
    message: z.string().describe("The text message body"),
  }),
  execute: async ({ to, message }: { to: string; message: string }) => {
    const { loadCommsEnv } = await import("@/lib/env");
    loadCommsEnv();

    const twilio = (await import("twilio")).default;
    const { addSms } = await import("@/lib/stores/sms-store");

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      return { error: "Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER." };
    }

    try {
      const client = twilio(accountSid, authToken);
      const result = await client.messages.create({
        body: message,
        from: fromNumber,
        to,
      });

      addSms({
        from: fromNumber,
        to,
        body: message,
        direction: "outbound",
        status: "sent",
        timestamp: new Date().toISOString(),
        twilioSid: result.sid,
      });

      return { success: true, to, message, sid: result.sid };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "SMS send failed" };
    }
  },
};

export const listSmsTool = {
  name: "list_sms",
  description: "List SMS conversations or messages with a specific phone number. Without a phone number, returns recent conversations. With a phone number, returns the full message thread.",
  inputSchema: z.object({
    phone: z.string().optional().describe("Phone number to get conversation with. Omit to list all recent conversations."),
    limit: z.number().optional().default(20).describe("Max conversations to return"),
  }),
  execute: async ({ phone, limit }: { phone?: string; limit?: number }) => {
    const { getSmsConversation, getRecentConversations } = await import("@/lib/stores/sms-store");

    if (phone) {
      const messages = getSmsConversation(phone);
      return {
        phone,
        messages: messages.map((m) => ({
          direction: m.direction,
          body: m.body,
          timestamp: m.timestamp,
          status: m.status,
        })),
      };
    }

    const conversations = getRecentConversations(limit ?? 20);
    return {
      conversations: conversations.map((c) => ({
        phone: c.phoneNumber,
        lastMessage: c.lastMessage.body.slice(0, 100),
        lastTime: c.lastMessage.timestamp,
        direction: c.lastMessage.direction,
        count: c.messageCount,
      })),
    };
  },
};
