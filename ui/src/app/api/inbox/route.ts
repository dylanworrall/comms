import { NextResponse } from "next/server";
import { getEmails, getUnreadCount, markRead, addEmail } from "@/lib/stores/inbox-store";
import { createApproval } from "@/lib/stores/approvals";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const folder = url.searchParams.get("folder") as "inbox" | "sent" | "drafts" | "trash" | null;
  const unreadOnly = url.searchParams.get("unreadOnly") === "true";
  const flagged = url.searchParams.get("flagged") === "true";
  const limit = Number(url.searchParams.get("limit") ?? 50);

  const emails = getEmails({ folder: folder ?? undefined, unreadOnly, flagged, limit });
  const unreadCount = getUnreadCount();

  return NextResponse.json({ emails, unreadCount });
}

export async function POST(req: Request) {
  const body = await req.json();

  if (body.action === "markRead") {
    markRead(body.id);
    return NextResponse.json({ success: true });
  }

  if (body.action === "compose") {
    // Create approval for sending
    const approval = createApproval("send_email", {
      to: body.to,
      cc: body.cc || undefined,
      subject: body.subject,
      body: body.body,
    });
    return NextResponse.json({ approval, needsApproval: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
