import { NextResponse } from "next/server";
import { loadCommsEnv } from "@/lib/env";
import { requireAuth, getCurrentUser } from "@/lib/api-auth";

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;

  loadCommsEnv(true);

  // Per-user number (cloud) or global fallback (local)
  const user = await getCurrentUser();
  const smsNumber = user?.smsNumber || process.env.TWILIO_SMS_NUMBER;
  const verificationSid = user?.smsVerificationSid || process.env.TWILIO_TF_VERIFICATION_SID;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!smsNumber) {
    return NextResponse.json({ smsNumber: null, verificationStatus: null });
  }

  let verificationStatus = user?.smsVerificationStatus || null;

  // Fetch live status from Twilio if we have a verification SID
  if (verificationSid && accountSid && authToken) {
    try {
      const twilio = (await import("twilio")).default;
      const client = twilio(accountSid, authToken);
      const v = await client.messaging.v1.tollfreeVerifications(verificationSid).fetch();
      verificationStatus = v.status;
    } catch { /* silent */ }
  }

  return NextResponse.json({ smsNumber, verificationStatus });
}
