import { NextResponse } from "next/server";
import twilio from "twilio";
import { loadCommsEnv } from "@/lib/env";
import { addSms, getAllSms, getSmsConversation, getRecentConversations } from "@/lib/stores/sms-store";
import { requireAuth } from "@/lib/api-auth";

export async function GET(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  const url = new URL(req.url);
  const phoneNumber = url.searchParams.get("phone");

  if (phoneNumber) {
    const messages = getSmsConversation(phoneNumber);
    return NextResponse.json({ messages });
  }

  const conversations = getRecentConversations();
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
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json(
      { error: "Missing Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)" },
      { status: 500 }
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

    return NextResponse.json({ sms, twilioSid: result.sid });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `SMS send failed: ${msg}` }, { status: 500 });
  }
}
