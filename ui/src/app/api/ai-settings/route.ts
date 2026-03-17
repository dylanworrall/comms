import { NextResponse } from "next/server";
import { getAISettings, updateAISettings } from "@/lib/stores/ai-settings-store";

export async function GET() {
  const settings = getAISettings();
  // Don't send processedIds to the client — it can be huge
  const { processedIds, ...rest } = settings;
  return NextResponse.json({ ...rest, processedCount: processedIds.length });
}

export async function POST(req: Request) {
  const body = await req.json();
  const updated = updateAISettings(body);
  const { processedIds, ...rest } = updated;
  return NextResponse.json({ ...rest, processedCount: processedIds.length });
}
