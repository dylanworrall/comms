import { NextResponse } from "next/server";
import { loadCommsEnv } from "@/lib/env";
import { addCall } from "@/lib/stores/calls-store";
import { addActivity } from "@/lib/stores/activity";
import { requireAuth } from "@/lib/api-auth";

loadCommsEnv();

/**
 * Place an outbound AI voice call.
 * The call connects to Gemini's real-time voice API via WebSocket,
 * so the AI agent speaks directly to the person being called.
 */
export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;
  loadCommsEnv(true);

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!accountSid || !authToken) {
    return NextResponse.json(
      { error: "Twilio credentials not configured." },
      { status: 400 }
    );
  }

  if (!fromNumber) {
    return NextResponse.json(
      { error: "No phone number configured. Get one in Settings > Voice." },
      { status: 400 }
    );
  }

  if (!appUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL not set. Required for voice callbacks." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { phoneNumber, contactName } = body as {
    phoneNumber: string;
    contactName?: string;
  };

  if (!phoneNumber) {
    return NextResponse.json(
      { error: "phoneNumber is required" },
      { status: 400 }
    );
  }

  try {
    const twilio = (await import("twilio")).default;
    const client = twilio(accountSid, authToken);

    // Place call with TwiML that connects to AI voice stream
    const call = await client.calls.create({
      to: phoneNumber,
      from: fromNumber,
      url: `${appUrl}/api/twilio/webhook?type=voice-ai`,
      statusCallback: `${appUrl}/api/twilio/webhook`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    });

    const callSid = call.sid;

    // Save the call record
    const callRecord = addCall({
      contactName: contactName || "Unknown",
      phoneNumber,
      direction: "outbound",
      status: "completed",
      duration: 0,
      timestamp: new Date().toISOString(),
      notes: `AI voice call: sid=${callSid}`,
    });

    addActivity(
      "call_initiated",
      `AI voice call to ${contactName || phoneNumber}`,
      { callSid, callId: callRecord.id }
    );

    return NextResponse.json({
      success: true,
      callId: callRecord.id,
      callSid,
    });
  } catch (err) {
    console.error("Twilio AI voice call error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to place AI voice call: ${message}` },
      { status: 500 }
    );
  }
}
