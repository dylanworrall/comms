import { NextResponse } from "next/server";
import twilio from "twilio";
import { loadCommsEnv } from "@/lib/env";
import { addSms, getSmsConversation, getRecentConversations } from "@/lib/stores/sms-store";
import { logInteraction } from "@/lib/stores/contacts";
import { requireAuth, getCurrentUser } from "@/lib/api-auth";

export async function GET(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  const url = new URL(req.url);
  const phoneNumber = url.searchParams.get("phone");

  if (phoneNumber) {
    const raw = getSmsConversation(phoneNumber);
    const messages = raw.map((m) => ({
      direction: m.direction,
      body: m.body,
      timestamp: m.timestamp,
      status: m.status,
    }));
    return NextResponse.json({ messages });
  }

  const raw = getRecentConversations();
  const conversations = raw.map((c) => ({
    phone: c.phoneNumber,
    lastMessage: c.lastMessage.body?.slice(0, 100) ?? "",
    lastTime: c.lastMessage.timestamp,
    direction: c.lastMessage.direction,
    count: c.messageCount,
  }));
  return NextResponse.json({ conversations });
}

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  loadCommsEnv();

  const body = await req.json();
  const { to, message } = body;

  if (!to || !message) {
    return NextResponse.json({ error: "Missing 'to' or 'message'" }, { status: 400 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  // Per-user SMS number (cloud) or global fallback (local)
  const user = await getCurrentUser();
  const fromNumber = user?.smsNumber || process.env.TWILIO_SMS_NUMBER || process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json(
      { error: "No SMS number configured. Set one up in Settings > SMS." },
      { status: 400 }
    );
  }

  try {
    const client = twilio(accountSid, authToken);
    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to,
    });

    const sms = addSms({
      from: fromNumber,
      to,
      body: message,
      direction: "outbound",
      status: "sent",
      timestamp: new Date().toISOString(),
      twilioSid: result.sid,
    });

    // Log touch point on matching contact
    logInteraction({
      phone: to,
      touchPoint: { type: "sms_sent", summary: `Sent: ${message.slice(0, 60)}`, timestamp: new Date().toISOString() },
    });

    return NextResponse.json({ sms, twilioSid: result.sid });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `SMS send failed: ${msg}` }, { status: 500 });
  }
}
