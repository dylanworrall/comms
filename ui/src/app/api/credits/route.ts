import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  return NextResponse.json({ tier: "local", messageCount: 0, limit: Infinity, mode: "local", credits: Infinity });
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  return NextResponse.json({ ok: true, mode: "local" });
}
