import { NextResponse } from "next/server";
import { loadCommsEnv } from "@/lib/env";
import { addCall } from "@/lib/stores/calls-store";
import { requireAuth } from "@/lib/api-auth";

loadCommsEnv();

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;
  loadCommsEnv(true);

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return NextResponse.json(
      { error: "Twilio credentials not configured." },
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

    // Get the first available phone number to use as caller ID
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    if (!fromNumber) {
      return NextResponse.json(
        { error: "TWILIO_FROM_NUMBER not configured. Set a Twilio phone number." },
        { status: 400 }
      );
    }

    const call = await client.calls.create({
      to: phoneNumber,
      from: fromNumber,
      record: true,
      recordingChannels: "dual",
      url: `${process.env.NEXT_PUBLIC_APP_URL || "https://localhost:3000"}/api/twilio/webhook?type=twiml`,
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
      notes: `Twilio call: sid=${callSid}`,
    });

    return NextResponse.json({
      success: true,
      callId: callRecord.id,
      callSid,
    });
  } catch (err) {
    console.error("Twilio call error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to place call: ${message}` },
      { status: 500 }
    );
  }
}
