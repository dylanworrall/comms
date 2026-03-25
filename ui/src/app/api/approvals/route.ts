import { NextResponse } from "next/server";
import { getApprovals, resolveApproval } from "@/lib/stores/approvals";
import { addActivity } from "@/lib/stores/activity";
import { loadCommsEnv } from "@/lib/env";
import { getConvexClient, isConvexMode } from "@/lib/convex-server";
import { api } from "@/lib/convex-api";
import { requireAuth } from "@/lib/api-auth";

// Load ~/.comms/.env on module init so RESEND_API_KEY is available
loadCommsEnv();

export async function GET(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;
  const url = new URL(req.url);
  const status = url.searchParams.get("status") as "pending" | "approved" | "rejected" | null;

  if (isConvexMode()) {
    const convex = getConvexClient()!;
    const approvals = await convex.query(api.approvals.list, {
      status: status ?? undefined,
    });
    return NextResponse.json({ approvals });
  }

  const items = getApprovals(status ?? undefined);
  return NextResponse.json({ approvals: items });
}

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  const body = await req.json();
  const { id, decision } = body as { id: string; decision: "approved" | "rejected" };

  if (!id || !decision) {
    return NextResponse.json({ error: "Missing id or decision" }, { status: 400 });
  }

  if (isConvexMode()) {
    const convex = getConvexClient()!;
    const result = await convex.mutation(api.approvals.resolve, {
      id: id as any,
      resolution: decision,
    });
    if (!result) {
      return NextResponse.json({ error: "Approval not found or already resolved" }, { status: 404 });
    }

    if (decision === "approved" && (result.type === "send_email" || result.type === "reply_to_email")) {
      try {
        await executeEmailSend(result.data as Record<string, unknown>);
        await convex.mutation(api.activityLog.add, {
          type: "email_sent",
          summary: `Email sent to ${(result.data as any).to}`,
          metadata: result.data,
        });
      } catch (err) {
        console.error("Failed to send email via Resend:", err);
        return NextResponse.json({ approval: result, emailError: "Failed to send email." });
      }
    }

    if (decision === "approved" && result.type === "initiate_call") {
      try {
        const callResult = await executeCall(result.data as Record<string, unknown>);
        // Use "approval_resolved" type for Convex since the schema may not include call-specific types
        await convex.mutation(api.activityLog.add, {
          type: "approval_resolved",
          summary: `Call placed to ${(result.data as any).contactName} (${(result.data as any).phoneNumber})`,
          metadata: callResult,
        });
      } catch (err) {
        console.error("Failed to place call via Twilio:", err);
        return NextResponse.json({
          approval: result,
          callError: `Failed to place call: ${err instanceof Error ? err.message : "Unknown error"}`,
        });
      }
    }

    await convex.mutation(api.activityLog.add, {
      type: "approval_resolved",
      summary: `${result.type} ${decision}`,
    });
    return NextResponse.json({ approval: result });
  }

  const result = resolveApproval(id, decision);
  if (!result) {
    return NextResponse.json({ error: "Approval not found or already resolved" }, { status: 404 });
  }

  if (decision === "approved" && (result.type === "send_email" || result.type === "reply_to_email")) {
    try {
      await executeEmailSend(result.data);
      addActivity("email_sent", `Email sent to ${result.data.to}`, result.data);
    } catch (err) {
      console.error("Failed to send email via Resend:", err);
      return NextResponse.json({ approval: result, emailError: "Failed to send email. Check RESEND_API_KEY." });
    }
  }

  if (decision === "approved" && result.type === "initiate_call") {
    try {
      const callResult = await executeCall(result.data);
      addActivity("call_placed", `Call placed to ${result.data.contactName} (${result.data.phoneNumber})`, callResult);
    } catch (err) {
      console.error("Failed to place call via Twilio:", err);
      return NextResponse.json({
        approval: result,
        callError: `Failed to place call: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    }
  }

  addActivity("approval_resolved", `${result.type} ${decision} (ID: ${result.id})`);
  return NextResponse.json({ approval: result });
}

async function executeEmailSend(data: Record<string, unknown>) {
  if (data.via === "gmail-api") {
    return sendEmailViaGmailApi(data);
  }
  return sendEmailViaResend(data);
}

async function sendEmailViaGmailApi(data: Record<string, unknown>) {
  const { google } = await import("googleapis");
  const { loadCommsEnv } = await import("@/lib/env");
  const { getGmailAccount, getDefaultGmailAccount, saveGmailAccount } = await import("@/lib/stores/gmail-store");

  loadCommsEnv();

  const accountEmail = String(data.account || "");
  const account = accountEmail
    ? getGmailAccount(accountEmail)
    : getDefaultGmailAccount();

  if (!account) {
    throw new Error("No Gmail account connected. Visit Settings > Email to connect Gmail.");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.");
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.expiresAt,
  });

  oauth2Client.on("tokens", (tokens) => {
    saveGmailAccount({
      ...account,
      accessToken: tokens.access_token || account.accessToken,
      expiresAt: tokens.expiry_date || account.expiresAt,
    });
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const to = String(data.to);
  const subject = String(data.subject);
  const body = String(data.body);
  const cc = data.cc ? String(data.cc) : "";

  // Build RFC 2822 message
  const inReplyTo = data.inReplyTo ? String(data.inReplyTo) : "";
  const threadId = data.threadId ? String(data.threadId) : "";

  const messageParts = [
    `From: ${account.email}`,
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    `Subject: ${subject}`,
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`, `References: ${inReplyTo}`] : []),
    "",
    body,
  ];
  const rawMessage = Buffer.from(messageParts.join("\r\n"))
    .toString("base64url");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: rawMessage,
      ...(threadId ? { threadId } : {}),
    },
  });

  // Save to inbox
  const { addEmail } = await import("@/lib/stores/inbox-store");
  addEmail({
    from: account.email,
    fromName: "You",
    to,
    cc: cc || undefined,
    subject,
    body,
    timestamp: new Date().toISOString(),
    read: true,
    flagged: false,
    folder: "sent",
  });
}

async function sendEmailViaResend(data: Record<string, unknown>) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY not set. Configure in Settings > Email.");
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const fromEmail = process.env.COMMS_FROM_EMAIL ?? "Comms Client <onboarding@resend.dev>";
  const to = String(data.to);
  const subject = String(data.subject);
  const body = String(data.body);

  await resend.emails.send({
    from: fromEmail,
    to,
    subject,
    text: body,
    ...(data.cc ? { cc: String(data.cc).split(",").map((s) => s.trim()) } : {}),
  });

  // Save to inbox as sent email
  const { addEmail } = await import("@/lib/stores/inbox-store");
  addEmail({
    from: fromEmail.includes("<") ? fromEmail.match(/<(.+)>/)?.[1] ?? fromEmail : fromEmail,
    fromName: "You",
    to,
    cc: data.cc ? String(data.cc) : undefined,
    subject,
    body,
    timestamp: new Date().toISOString(),
    read: true,
    flagged: false,
    folder: "sent",
  });
}

async function executeCall(data: Record<string, unknown>) {
  const { loadCommsEnv } = await import("@/lib/env");
  loadCommsEnv();

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://localhost:3000";

  if (!accountSid || !authToken) {
    throw new Error(
      "Twilio not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in Settings > Voice."
    );
  }

  if (!fromNumber) {
    throw new Error("TWILIO_FROM_NUMBER not configured.");
  }

  const phoneNumber = String(data.phoneNumber);
  const contactName = String(data.contactName || "Unknown");
  const isAiVoiceCall = !!data.aiVoiceCall;
  const purpose = String(data.purpose || "");

  const twilio = (await import("twilio")).default;
  const client = twilio(accountSid, authToken);

  // Build webhook URL — AI voice calls include purpose for context
  let webhookUrl = `${appUrl}/api/twilio/webhook?type=${isAiVoiceCall ? "voice-ai" : "twiml"}`;
  if (isAiVoiceCall && purpose) {
    webhookUrl += `&purpose=${encodeURIComponent(purpose)}`;
  }

  const call = await client.calls.create({
    to: phoneNumber,
    from: fromNumber,
    ...(isAiVoiceCall ? {} : { record: true, recordingChannels: "dual" }),
    url: webhookUrl,
    statusCallback: `${appUrl}/api/twilio/webhook`,
    statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
  });

  const callSid = call.sid;

  // Save call record
  const { addCall } = await import("@/lib/stores/calls-store");
  const callRecord = addCall({
    contactName,
    phoneNumber,
    direction: "outbound",
    status: "completed",
    duration: 0,
    timestamp: new Date().toISOString(),
    notes: `${isAiVoiceCall ? "AI voice" : "Twilio"} call (approval): sid=${callSid}`,
  });

  return {
    callId: callRecord.id,
    callSid,
    aiVoiceCall: isAiVoiceCall,
  };
}
