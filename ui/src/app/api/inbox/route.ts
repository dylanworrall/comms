import { NextResponse } from "next/server";
import { getEmails, getUnreadCount, markRead, addEmail, deleteEmail } from "@/lib/stores/inbox-store";
import { createApproval } from "@/lib/stores/approvals";
import { getConvexClient, isConvexMode } from "@/lib/convex-server";
import { api } from "@/lib/convex-api";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const folder = url.searchParams.get("folder") as "inbox" | "sent" | "drafts" | "trash" | null;
  const unreadOnly = url.searchParams.get("unreadOnly") === "true";
  const flagged = url.searchParams.get("flagged") === "true";
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const senderType = url.searchParams.get("senderType") as "human" | "auto" | null;
  const tag = url.searchParams.get("tag");
  const sortBy = url.searchParams.get("sortBy") as "time" | "priority" | null;

  if (isConvexMode()) {
    const convex = getConvexClient()!;
    const emails = await convex.query(api.emails.list, {
      folder: folder ?? undefined,
      unreadOnly: unreadOnly || undefined,
      flagged: flagged || undefined,
      limit,
    });
    const unreadCount = await convex.query(api.emails.unreadCount, {});
    return NextResponse.json({ emails, unreadCount });
  }

  const emails = getEmails({
    folder: folder ?? undefined,
    unreadOnly,
    flagged,
    limit,
    senderType: senderType ?? undefined,
    tag: tag ?? undefined,
    sortBy: sortBy ?? undefined,
  });
  const unreadCount = getUnreadCount();
  return NextResponse.json({ emails, unreadCount });
}

export async function POST(req: Request) {
  const body = await req.json();

  if (body.action === "markRead") {
    if (isConvexMode()) {
      const convex = getConvexClient()!;
      await convex.mutation(api.emails.markRead, { id: body.id });
      return NextResponse.json({ success: true });
    }
    markRead(body.id);
    return NextResponse.json({ success: true });
  }

  if (body.action === "delete") {
    if (isConvexMode()) {
      const convex = getConvexClient()!;
      await convex.mutation(api.emails.remove, { id: body.id });
      return NextResponse.json({ success: true });
    }
    const deleted = deleteEmail(body.id);
    return NextResponse.json({ success: deleted });
  }

  if (body.action === "compose") {
    if (isConvexMode()) {
      const convex = getConvexClient()!;
      const approval = await convex.mutation(api.approvals.create, {
        type: "send_email",
        data: { to: body.to, cc: body.cc || undefined, subject: body.subject, body: body.body },
      });
      return NextResponse.json({ approval, needsApproval: true });
    }
    const approval = createApproval("send_email", {
      to: body.to, cc: body.cc || undefined, subject: body.subject, body: body.body,
    });
    return NextResponse.json({ approval, needsApproval: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
