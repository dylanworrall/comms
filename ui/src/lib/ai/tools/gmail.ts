import { z } from "zod";
import { google } from "googleapis";
import { loadCommsEnv } from "@/lib/env";
import {
  getGmailAccount,
  getDefaultGmailAccount,
  saveGmailAccount,
} from "@/lib/stores/gmail-store";

function getGmailClient(account?: string) {
  loadCommsEnv();

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET. Set them in ~/.comms/.env."
    );
  }

  const acct = account
    ? getGmailAccount(account)
    : getDefaultGmailAccount();

  if (!acct) {
    throw new Error(
      account
        ? `No Gmail account found for ${account}. Connect at /api/gmail/auth.`
        : "No Gmail accounts connected. Visit /api/gmail/auth to connect one."
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({
    access_token: acct.accessToken,
    refresh_token: acct.refreshToken,
    expiry_date: acct.expiresAt,
  });

  // Auto-refresh: persist new tokens when they arrive
  oauth2Client.on("tokens", (tokens) => {
    saveGmailAccount({
      ...acct,
      accessToken: tokens.access_token || acct.accessToken,
      expiresAt: tokens.expiry_date || acct.expiresAt,
    });
  });

  return {
    gmail: google.gmail({ version: "v1", auth: oauth2Client }),
    account: acct,
  };
}

interface GmailHeader {
  name: string;
  value: string;
}

function getHeader(headers: GmailHeader[], name: string): string {
  return (
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ||
    ""
  );
}

export const searchGmailTool = {
  name: "search_gmail",
  description:
    "Search Gmail using Google search syntax. Returns threads matching the query. Requires a connected Gmail account (via /api/gmail/auth).",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "Gmail search query (e.g. 'from:john subject:meeting', 'is:unread', 'newer_than:3d')"
      ),
    limit: z
      .number()
      .optional()
      .default(10)
      .describe("Max results to return"),
    account: z
      .string()
      .optional()
      .describe("Gmail account to use (defaults to primary connected account)"),
  }),
  execute: async ({ query, limit, account }: { query: string; limit: number; account?: string }) => {
    try {
      const { gmail, account: acct } = getGmailClient(account);

      const res = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: limit,
      });

      const messageRefs = res.data.messages || [];
      if (messageRefs.length === 0) {
        return { message: "No messages found matching query.", threads: [] };
      }

      // Fetch snippet + headers for each message
      const threads = await Promise.all(
        messageRefs.map(async (ref) => {
          try {
            const msg = await gmail.users.messages.get({
              userId: "me",
              id: ref.id!,
              format: "metadata",
              metadataHeaders: ["From", "Subject", "Date"],
            });
            const headers = (msg.data.payload?.headers || []) as GmailHeader[];
            return {
              id: ref.id,
              threadId: ref.threadId,
              from: getHeader(headers, "From"),
              subject: getHeader(headers, "Subject"),
              date: getHeader(headers, "Date"),
              snippet: msg.data.snippet,
            };
          } catch {
            return {
              id: ref.id,
              threadId: ref.threadId,
              snippet: "(failed to load)",
            };
          }
        })
      );

      return {
        message: `${threads.length} result(s) found in ${acct.email}`,
        threads,
      };
    } catch (err) {
      return {
        message: `Search failed: ${err instanceof Error ? err.message : "unknown error"}`,
      };
    }
  },
};

export const readGmailThreadTool = {
  name: "read_gmail_thread",
  description:
    "Read a full Gmail thread by thread ID. Returns all messages in the thread with full body text.",
  inputSchema: z.object({
    threadId: z.string().describe("The Gmail thread ID to read"),
    account: z
      .string()
      .optional()
      .describe("Gmail account to use"),
  }),
  execute: async ({ threadId, account }: { threadId: string; account?: string }) => {
    try {
      const { gmail } = getGmailClient(account);

      const res = await gmail.users.threads.get({
        userId: "me",
        id: threadId,
        format: "full",
      });

      const messages = (res.data.messages || []).map((msg) => {
        const headers = (msg.payload?.headers || []) as GmailHeader[];

        // Extract body text
        let body = "";
        const payload = msg.payload as Record<string, unknown> | undefined;
        if (payload) {
          body = extractBody(payload);
        }
        if (!body) body = msg.snippet || "";

        return {
          id: msg.id,
          from: getHeader(headers, "From"),
          to: getHeader(headers, "To"),
          cc: getHeader(headers, "Cc") || undefined,
          subject: getHeader(headers, "Subject"),
          date: getHeader(headers, "Date"),
          body,
        };
      });

      return {
        message: `Thread with ${messages.length} message(s)`,
        threadId,
        messages,
      };
    } catch (err) {
      return {
        message: `Read failed: ${err instanceof Error ? err.message : "unknown error"}`,
      };
    }
  },
};

export const syncGmailTool = {
  name: "sync_gmail",
  description:
    "Sync recent Gmail messages into the local inbox. Imports new emails that haven't been synced yet.",
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .default("is:inbox")
      .describe("Gmail search query to sync"),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe("Max emails to sync"),
    account: z
      .string()
      .optional()
      .describe("Gmail account to use"),
  }),
  execute: async ({ query, limit, account }: { query: string; limit: number; account?: string }) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const res = await fetch(`${baseUrl}/api/gmail/sync`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, limit, account }),
      });
      const data = await res.json();
      if (!res.ok) return { message: data.error || "Sync failed" };
      return { message: data.message, count: data.count };
    } catch (err) {
      return {
        message: `Sync failed: ${err instanceof Error ? err.message : "unknown error"}`,
      };
    }
  },
};

export const sendGmailTool = {
  name: "send_gmail",
  description:
    "Send an email via Gmail. Creates an approval item — the email is NOT sent until the user approves it in the approval queue. This is the PRIMARY tool for sending emails.",
  inputSchema: z.object({
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Email subject"),
    body: z.string().describe("Email body text"),
    cc: z.string().optional().describe("CC recipients (comma-separated)"),
    account: z
      .string()
      .optional()
      .describe("Gmail account to send from"),
  }),
  execute: async ({ to, subject, body, cc, account }: { to: string; subject: string; body: string; cc?: string; account?: string }) => {
    try {
      // Validate that we have a connected account
      const acct = account
        ? getGmailAccount(account)
        : getDefaultGmailAccount();

      if (!acct) {
        return {
          message: account
            ? `No Gmail account found for ${account}. Connect at /api/gmail/auth.`
            : "No Gmail accounts connected. Visit /api/gmail/auth to connect one.",
        };
      }

      const { createApproval } = await import("@/lib/stores/approvals");
      const approval = createApproval("send_email", {
        to,
        subject,
        body,
        cc,
        via: "gmail-api",
        account: acct.email,
      });

      return {
        message: `Email draft queued for approval (ID: ${approval.id}). Will send via Gmail API from ${acct.email} when approved.`,
        needsApproval: true,
        approvalId: approval.id,
        draft: { to, subject, body, cc, from: acct.email },
      };
    } catch (err) {
      return {
        message: `Failed: ${err instanceof Error ? err.message : "unknown error"}`,
      };
    }
  },
};

export const draftGmailTool = {
  name: "draft_gmail",
  description:
    "Create a real Gmail draft that appears in the user's Gmail Drafts folder. Use this when the user wants to draft an email they can review and send later from Gmail.",
  inputSchema: z.object({
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Email subject"),
    body: z.string().describe("Email body text"),
    cc: z.string().optional().describe("CC recipients (comma-separated)"),
    account: z
      .string()
      .optional()
      .describe("Gmail account to create draft in"),
  }),
  execute: async ({ to, subject, body, cc, account }: { to: string; subject: string; body: string; cc?: string; account?: string }) => {
    try {
      const { gmail, account: acct } = getGmailClient(account);

      const messageParts = [
        `From: ${acct.email}`,
        `To: ${to}`,
        ...(cc ? [`Cc: ${cc}`] : []),
        `Subject: ${subject}`,
        "Content-Type: text/plain; charset=utf-8",
        "",
        body,
      ];
      const rawMessage = Buffer.from(messageParts.join("\r\n")).toString("base64url");

      const res = await gmail.users.drafts.create({
        userId: "me",
        requestBody: { message: { raw: rawMessage } },
      });

      return {
        message: `Draft created in Gmail (ID: ${res.data.id}). You can find it in your Gmail Drafts folder.`,
        draftId: res.data.id,
        draft: { to, subject, body, cc, from: acct.email },
      };
    } catch (err) {
      return {
        message: `Failed to create draft: ${err instanceof Error ? err.message : "unknown error"}`,
      };
    }
  },
};

export const trashGmailTool = {
  name: "trash_gmail",
  description:
    "Move a Gmail message to Trash by message ID. Use this when the user wants to delete an email.",
  inputSchema: z.object({
    messageId: z.string().describe("The Gmail message ID to trash"),
    account: z.string().optional().describe("Gmail account to use"),
  }),
  execute: async ({ messageId, account }: { messageId: string; account?: string }) => {
    try {
      const { gmail } = getGmailClient(account);
      await gmail.users.messages.trash({ userId: "me", id: messageId });
      return { message: `Message ${messageId} moved to Trash.` };
    } catch (err) {
      return {
        message: `Failed to trash message: ${err instanceof Error ? err.message : "unknown error"}`,
      };
    }
  },
};

export const archiveGmailTool = {
  name: "archive_gmail",
  description:
    "Archive a Gmail message (remove INBOX label so it no longer appears in inbox but is still accessible). Use this when the user wants to clean up their inbox without deleting.",
  inputSchema: z.object({
    messageId: z.string().describe("The Gmail message ID to archive"),
    account: z.string().optional().describe("Gmail account to use"),
  }),
  execute: async ({ messageId, account }: { messageId: string; account?: string }) => {
    try {
      const { gmail } = getGmailClient(account);
      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: { removeLabelIds: ["INBOX"] },
      });
      return { message: `Message ${messageId} archived.` };
    } catch (err) {
      return {
        message: `Failed to archive message: ${err instanceof Error ? err.message : "unknown error"}`,
      };
    }
  },
};

export const markGmailReadTool = {
  name: "mark_gmail_read",
  description:
    "Mark a Gmail message as read or unread.",
  inputSchema: z.object({
    messageId: z.string().describe("The Gmail message ID"),
    unread: z.boolean().optional().default(false).describe("Set to true to mark as unread, false (default) to mark as read"),
    account: z.string().optional().describe("Gmail account to use"),
  }),
  execute: async ({ messageId, unread, account }: { messageId: string; unread: boolean; account?: string }) => {
    try {
      const { gmail } = getGmailClient(account);
      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: unread
          ? { addLabelIds: ["UNREAD"] }
          : { removeLabelIds: ["UNREAD"] },
      });
      return { message: `Message ${messageId} marked as ${unread ? "unread" : "read"}.` };
    } catch (err) {
      return {
        message: `Failed: ${err instanceof Error ? err.message : "unknown error"}`,
      };
    }
  },
};

export const replyGmailTool = {
  name: "reply_gmail",
  description:
    "Reply to a Gmail thread. Creates an approval item — the reply is NOT sent until the user approves it. Use this instead of reply_to_email when working with Gmail threads.",
  inputSchema: z.object({
    threadId: z.string().describe("The Gmail thread ID to reply to"),
    body: z.string().describe("Reply body text"),
    account: z.string().optional().describe("Gmail account to use"),
  }),
  execute: async ({ threadId, body, account }: { threadId: string; body: string; account?: string }) => {
    try {
      const { gmail, account: acct } = getGmailClient(account);

      // Get the thread to find the last message's headers
      const thread = await gmail.users.threads.get({
        userId: "me",
        id: threadId,
        format: "metadata",
        metadataHeaders: ["From", "To", "Subject", "Message-ID"],
      });

      const msgs = thread.data.messages || [];
      if (msgs.length === 0) {
        return { message: "Thread not found or empty." };
      }

      const lastMsg = msgs[msgs.length - 1];
      const headers = (lastMsg.payload?.headers || []) as GmailHeader[];
      const from = getHeader(headers, "From");
      const subject = getHeader(headers, "Subject");
      const messageId = getHeader(headers, "Message-ID");

      // Reply goes to whoever sent the last message (unless it was us)
      const replyTo = from.includes(acct.email)
        ? getHeader(headers, "To")
        : from;
      const replySubject = subject.startsWith("Re: ") ? subject : `Re: ${subject}`;

      const { createApproval } = await import("@/lib/stores/approvals");
      const approval = createApproval("send_email", {
        to: replyTo,
        subject: replySubject,
        body,
        via: "gmail-api",
        account: acct.email,
        threadId,
        inReplyTo: messageId,
      });

      return {
        message: `Reply draft queued for approval (ID: ${approval.id}). Replying to ${replyTo} via Gmail.`,
        needsApproval: true,
        approvalId: approval.id,
        draft: { to: replyTo, subject: replySubject, body, from: acct.email },
      };
    } catch (err) {
      return {
        message: `Failed: ${err instanceof Error ? err.message : "unknown error"}`,
      };
    }
  },
};

/** Recursively extract text body from Gmail message payload */
function extractBody(payload: Record<string, unknown>): string {
  const body = payload.body as { data?: string } | undefined;
  if (body?.data) {
    return Buffer.from(body.data, "base64url").toString("utf-8");
  }

  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  if (parts) {
    for (const mimeType of ["text/plain", "text/html"]) {
      const part = parts.find((p) => p.mimeType === mimeType);
      if (part) {
        const partBody = part.body as { data?: string } | undefined;
        if (partBody?.data) {
          let text = Buffer.from(partBody.data, "base64url").toString("utf-8");
          if (mimeType === "text/html") {
            text = text.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
          }
          return text;
        }
      }
    }

    // Recurse into nested parts
    for (const part of parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }

  return "";
}
