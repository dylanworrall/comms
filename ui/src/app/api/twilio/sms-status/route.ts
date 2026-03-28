import { NextResponse } from "next/server";
import { loadCommsEnv } from "@/lib/env";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;

  loadCommsEnv(true);

  const smsNumber = process.env.TWILIO_SMS_NUMBER;
  const verificationSid = process.env.TWILIO_TF_VERIFICATION_SID;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!smsNumber) {
    return NextResponse.json({ smsNumber: null, verificationStatus: null });
  }

  let verificationStatus = null;

  if (verificationSid && accountSid && authToken) {
    try {
      const twilio = (await import("twilio")).default;
      const client = twilio(accountSid, authToken);
      const v = await client.messaging.v1.tollfreeVerifications(verificationSid).fetch();
      verificationStatus = v.status;
    } catch {
      // If we can't fetch, try listing all verifications for this number
      try {
        const twilio = (await import("twilio")).default;
        const client = twilio(accountSid, authToken);
        const list = await client.messaging.v1.tollfreeVerifications.list({ limit: 20 });
        const match = list.find((v) => v.tollfreePhoneNumberSid && smsNumber.includes(v.tollfreePhoneNumberSid));
        if (match) verificationStatus = match.status;
      } catch { /* silent */ }
    }
  }

  return NextResponse.json({ smsNumber, verificationStatus });
}
