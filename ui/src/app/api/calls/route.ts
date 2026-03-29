import { NextResponse } from "next/server";
import { getCalls, addCall } from "@/lib/stores/calls-store";
import { createApproval } from "@/lib/stores/approvals";
import { requireAuth } from "@/lib/api-auth";

export async function GET(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const direction = url.searchParams.get("direction") as "inbound" | "outbound" | null;

  const calls = getCalls({ limit, direction: direction ?? undefined });
  return NextResponse.json({ calls });
}

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

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
  const approval = createApproval("initiate_call", {
    phoneNumber: body.phoneNumber,
    contactName: body.contactName || "Unknown",
  });
  return NextResponse.json({ approval, needsApproval: true });
}
