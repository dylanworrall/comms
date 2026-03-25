import { NextResponse } from "next/server";
import { getAISettings, updateAISettings } from "@/lib/stores/ai-settings-store";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;
  const settings = getAISettings();
  // Don't send processedIds to the client — it can be huge
  const { processedIds, ...rest } = settings;
  return NextResponse.json({ ...rest, processedCount: processedIds.length });
}

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  const body = await req.json();
  const updated = updateAISettings(body);
  const { processedIds, ...rest } = updated;
  return NextResponse.json({ ...rest, processedCount: processedIds.length });
}
