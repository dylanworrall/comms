import { NextResponse } from "next/server";
import { google } from "googleapis";
import { loadCommsEnv } from "@/lib/env";
import {
  getGmailAccount,
  getDefaultGmailAccount,
  saveGmailAccount,
} from "@/lib/stores/gmail-store";
import { addEmail, getAllEmails } from "@/lib/stores/inbox-store";

interface GmailHeader {
  name: string;
  value: string;
}

function getHeader(headers: GmailHeader[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function parseFrom(raw: string): { email: string; name: string } {
  if (raw.includes("<")) {
    const name = raw.split("<")[0].trim().replace(/"/g, "");
    const email = raw.match(/<(.+)>/)?.[1] || raw;
    return { email, name: name || email };
  }
  return { email: raw, name: raw.split("@")[0] };
}

function getBodyPart(payload: Record<string, unknown>, targetMime: string): string {
  // Try direct body
  const mimeType = payload.mimeType as string | undefined;
  const body = payload.body as { data?: string; size?: number } | undefined;
  if (mimeType === targetMime && body?.data) {
    return Buffer.from(body.data, "base64url").toString("utf-8");
  }

  // Try parts (multipart messages)
  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  if (parts) {
    for (const part of parts) {
      const partMime = part.mimeType as string | undefined;
      if (partMime === targetMime) {
        const partBody = part.body as { data?: string } | undefined;
        if (partBody?.data) {
          return Buffer.from(partBody.data, "base64url").toString("utf-8");
        }
      }
    }
    // Recurse into nested multipart parts
    for (const part of parts) {
      const nested = getBodyPart(part, targetMime);
      if (nested) return nested;
    }
  }

  return "";
}

function getBody(payload: Record<string, unknown>): { text: string; html: string } {
  const plainText = getBodyPart(payload, "text/plain");
  const htmlText = getBodyPart(payload, "text/html");

  // For plain text body: prefer text/plain, fall back to stripped HTML
  const text = plainText || (htmlText ? htmlText.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim() : "");

  return { text, html: htmlText };
}

export async function POST(req: Request) {
  loadCommsEnv();

  const body = await req.json().catch(() => ({}));
  const accountEmail = body.account as string | undefined;
  const query = (body.query as string) || "is:inbox";
  const limit = (body.limit as number) || 20;

  // Resolve account
  const account = accountEmail
    ? getGmailAccount(accountEmail)
    : getDefaultGmailAccount();

  if (!account) {
    return NextResponse.json(
      {
        error: accountEmail
          ? `No Gmail account found for ${accountEmail}. Connect at /api/gmail/auth.`
          : "No Gmail accounts connected. Connect at /api/gmail/auth.",
      },
      { status: 400 }
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET." },
      { status: 500 }
    );
  }

  try {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
      expiry_date: account.expiresAt,
    });

    // Auto-refresh: listen for new tokens
    oauth2Client.on("tokens", (tokens) => {
      saveGmailAccount({
        ...account,
        accessToken: tokens.access_token || account.accessToken,
        expiresAt: tokens.expiry_date || account.expiresAt,
      });
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // List messages
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: limit,
    });

    const messageIds = listRes.data.messages || [];
    if (messageIds.length === 0) {
      return NextResponse.json({
        message: "No messages found matching query.",
        count: 0,
        account: account.email,
      });
    }

    // Check existing emails to avoid duplicates
    const existingEmails = getAllEmails();
    const existingThreadIds = new Set(
      existingEmails.map((e) => e.threadId).filter(Boolean)
    );

    let imported = 0;

    for (const msgRef of messageIds) {
      if (!msgRef.id) continue;

      // Skip if we already have this message
      const gmailThreadId = `gmail-${msgRef.threadId || msgRef.id}`;
      const gmailMsgId = `gmail-msg-${msgRef.id}`;

      // Check both thread-level and message-level dedup
      if (existingThreadIds.has(gmailMsgId)) continue;

      try {
        const msgRes = await gmail.users.messages.get({
          userId: "me",
          id: msgRef.id,
          format: "full",
        });

        const msg = msgRes.data;
        const headers = (msg.payload?.headers || []) as GmailHeader[];
        const fromRaw = getHeader(headers, "From");
        const { email: fromEmail, name: fromName } = parseFrom(fromRaw);
        const to = getHeader(headers, "To");
        const cc = getHeader(headers, "Cc") || undefined;
        const subject = getHeader(headers, "Subject") || "(no subject)";
        const date = getHeader(headers, "Date");
        const labelIds = msg.labelIds || [];

        const { text: bodyText, html: bodyHtml } = getBody(msg.payload as Record<string, unknown>);
        const finalBody = bodyText || msg.snippet || "";

        const isSent = labelIds.includes("SENT") || fromEmail === account.email;

        addEmail({
          from: fromEmail,
          fromName: fromName || fromEmail,
          to: to || account.email,
          cc,
          subject,
          body: finalBody,
          bodyHtml: bodyHtml || undefined,
          timestamp: date || new Date(Number(msg.internalDate) || Date.now()).toISOString(),
          read: !labelIds.includes("UNREAD"),
          flagged: labelIds.includes("STARRED"),
          folder: isSent ? "sent" : "inbox",
          threadId: gmailMsgId,
          gmailMessageId: msgRef.id || undefined,
        });

        existingThreadIds.add(gmailMsgId);
        imported++;
      } catch (msgErr) {
        // Skip individual message errors, continue syncing
        console.error(`Failed to fetch message ${msgRef.id}:`, msgErr);
      }
    }

    // Fire-and-forget: trigger AI processing on new emails
    if (imported > 0) {
      const origin = new URL(req.url).origin;
      fetch(`${origin}/api/ai/process-emails`, { method: "POST" }).catch(() => {});
    }

    return NextResponse.json({
      message: `Synced ${imported} email(s) from ${account.email}`,
      count: imported,
      account: account.email,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: `Gmail sync failed: ${message}` },
      { status: 500 }
    );
  }
}
