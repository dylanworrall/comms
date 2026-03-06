import { NextResponse } from "next/server";
import { getCalls, getAllCalls } from "@/lib/stores/calls-store";
import { createApproval } from "@/lib/stores/approvals";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const direction = url.searchParams.get("direction") as "inbound" | "outbound" | null;
  const calls = getCalls({ limit, direction: direction ?? undefined });
  return NextResponse.json({ calls });
}

export async function POST(req: Request) {
  const body = await req.json();
  // Create approval for outbound call
  const approval = createApproval("initiate_call", {
    phoneNumber: body.phoneNumber,
    contactName: body.contactName || "Unknown",
  });
  return NextResponse.json({ approval, needsApproval: true });
}
