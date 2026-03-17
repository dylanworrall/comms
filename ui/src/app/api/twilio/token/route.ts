import { NextResponse } from "next/server";
import { loadCommsEnv } from "@/lib/env";

loadCommsEnv();

export async function GET() {
  loadCommsEnv(true);

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

  if (!accountSid || !apiKeySid || !apiKeySecret) {
    return NextResponse.json(
      { error: "Twilio credentials not configured. Set TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, and TWILIO_API_KEY_SECRET." },
      { status: 400 }
    );
  }

  try {
    const twilio = (await import("twilio")).default;
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true,
    });

    const token = new AccessToken(
      accountSid,
      apiKeySid,
      apiKeySecret,
      { identity: "comms-user" }
    );

    token.addGrant(voiceGrant);

    return NextResponse.json({ token: token.toJwt() });
  } catch (err) {
    console.error("Twilio token error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate Twilio token: ${message}` },
      { status: 500 }
    );
  }
}
