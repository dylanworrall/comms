import { tool } from "ai";
import { z } from "zod";
import { getEmails, getEmailById, markRead, addEmail } from "@/lib/stores/inbox-store";
import { createApproval } from "@/lib/stores/approvals";

export const emailTools = {
  list_emails: tool({
    description:
      "List emails with optional filters for folder, unread status, flagged status, and result limit.",
    inputSchema: z.object({
      folder: z
        .enum(["inbox", "sent", "drafts", "trash"])
        .optional()
        .describe("Filter by folder"),
      unreadOnly: z
        .boolean()
        .optional()
        .describe("If true, only return unread emails"),
      flagged: z
        .boolean()
        .optional()
        .describe("If true, only return flagged emails"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of emails to return"),
    }),
    execute: async ({ folder, unreadOnly, flagged, limit }) => {
      const emails = getEmails({ folder, unreadOnly, flagged, limit });
      if (emails.length === 0) {
        return { message: "No emails match the given filters.", emails: [] };
      }
      return {
        message: `${emails.length} email(s) found`,
        emails: emails.map((e) => ({
          id: e.id,
          from: e.from,
          fromName: e.fromName,
          to: e.to,
          subject: e.subject,
          preview: e.preview,
          timestamp: e.timestamp,
          read: e.read,
          flagged: e.flagged,
          folder: e.folder,
          domainType: e.domainType,
          gmailMessageId: e.gmailMessageId,
        })),
      };
    },
  }),

  read_email: tool({
    description:
      "Read the full content of an email by ID. This also marks the email as read.",
    inputSchema: z.object({
      id: z.string().describe("The email ID to read"),
    }),
    execute: async ({ id }) => {
      const email = getEmailById(id);
      if (!email) {
        return { message: `No email found with ID "${id}"` };
      }
      // Mark as read
      markRead(id);
      return {
        message: `Email from ${email.fromName} — "${email.subject}"`,
        email,
      };
    },
  }),

  draft_email: tool({
    description:
      "Create and save a draft email. The draft is stored in the drafts folder and is NOT sent.",
    inputSchema: z.object({
      to: z.string().describe("Recipient email address"),
      subject: z.string().describe("Email subject line"),
      body: z.string().describe("Email body text"),
      cc: z.string().optional().describe("CC recipients (comma-separated)"),
    }),
    execute: async ({ to, subject, body, cc }) => {
      const draft = addEmail({
        from: "you@example.com",
        fromName: "You",
        to,
        cc,
        subject,
        body,
        timestamp: new Date().toISOString(),
        read: true,
        flagged: false,
        folder: "drafts",
      });
      return {
        message: `Draft saved: "${subject}" to ${to}`,
        draft: {
          id: draft.id,
          to,
          subject,
          body,
          cc,
        },
      };
    },
  }),

  send_email: tool({
    description:
      "Draft an email to send. This creates an approval item — the email is NOT sent until the user approves it in the approval queue.",
    inputSchema: z.object({
      to: z.string().describe("Recipient email address"),
      subject: z.string().describe("Email subject line"),
      body: z.string().describe("Email body text"),
      cc: z.string().optional().describe("CC recipients (comma-separated)"),
    }),
    execute: async ({ to, subject, body, cc }) => {
      const approval = createApproval("send_email", { to, subject, body, cc });
      return {
        message: `Email draft created and queued for approval (ID: ${approval.id}). The user must approve before it sends.`,
        needsApproval: true,
        approvalId: approval.id,
        draft: { to, subject, body, cc },
      };
    },
  }),

  reply_to_email: tool({
    description:
      "Reply to an existing email by ID. Creates an approval item — the reply is NOT sent until the user approves it.",
    inputSchema: z.object({
      emailId: z.string().describe("The ID of the email to reply to"),
      body: z.string().describe("Reply body text"),
    }),
    execute: async ({ emailId, body }) => {
      const original = getEmailById(emailId);
      if (!original) {
        return { message: `No email found with ID "${emailId}"` };
      }

      const replyTo = original.from === "you@example.com" ? original.to : original.from;
      const replySubject = original.subject.startsWith("Re: ")
        ? original.subject
        : `Re: ${original.subject}`;

      const approval = createApproval("reply_to_email", {
        originalEmailId: emailId,
        to: replyTo,
        subject: replySubject,
        body,
      });

      return {
        message: `Reply draft created and queued for approval (ID: ${approval.id}). Replying to ${replyTo}.`,
        needsApproval: true,
        approvalId: approval.id,
        draft: {
          to: replyTo,
          subject: replySubject,
          body,
          inReplyTo: emailId,
        },
      };
    },
  }),
};
