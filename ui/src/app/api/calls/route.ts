import { NextResponse } from "next/server";
import { getCalls, addCall } from "@/lib/stores/calls-store";
import { createApproval } from "@/lib/stores/approvals";
import { getConvexClient, isConvexMode } from "@/lib/convex-server";
import { api } from "@/lib/convex-api";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const direction = url.searchParams.get("direction") as "inbound" | "outbound" | null;

  if (isConvexMode()) {
    const convex = getConvexClient()!;
    const calls = await convex.query(api.calls.list, {
      limit,
      direction: direction ?? undefined,
    });
    return NextResponse.json({ calls });
  }

  const calls = getCalls({ limit, direction: direction ?? undefined });
  return NextResponse.json({ calls });
}

export async function POST(req: Request) {
  const body = await req.json();

  // Direct save mode — used by useTwilioCall hook after a WebRTC call ends
  if (body.direct) {
    const callRecord = addCall({
      contactName: body.contactName || "Unknown",
      phoneNumber: body.phoneNumber,
      direction: body.direction || "outbound",
      status: body.status || "completed",
      duration: body.duration || 0,
      timestamp: new Date().toISOString(),
      transcript: body.transcript,
      notes: body.notes,
    });
    return NextResponse.json({ call: callRecord });
  }

  // Approval mode — AI-initiated calls go through approval flow
  if (isConvexMode()) {
    const convex = getConvexClient()!;
    const approval = await convex.mutation(api.approvals.create, {
      type: "initiate_call",
      data: { phoneNumber: body.phoneNumber, contactName: body.contactName || "Unknown" },
    });
    return NextResponse.json({ approval, needsApproval: true });
  }

  const approval = createApproval("initiate_call", {
    phoneNumber: body.phoneNumber,
    contactName: body.contactName || "Unknown",
  });
  return NextResponse.json({ approval, needsApproval: true });
}
