import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/stores/settings";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;
  return NextResponse.json(getSettings());
}

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;
  const body = await req.json();
  const updated = updateSettings(body);
  return NextResponse.json(updated);
}
