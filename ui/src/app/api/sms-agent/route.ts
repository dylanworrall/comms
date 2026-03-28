import { NextResponse } from "next/server";
import {
  getSmsAgentConfig,
  updateSmsAgentConfig,
  getSmsTemplatePresets,
  applySmsPreset,
} from "@/lib/stores/sms-agent-store";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;

  const config = getSmsAgentConfig();
  const presets = getSmsTemplatePresets();
  return NextResponse.json({ config, presets });
}

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  const body = await req.json();

  // Apply a preset
  if (body.preset) {
    const config = applySmsPreset(body.preset);
    return NextResponse.json({ config });
  }

  // Update config
  const config = updateSmsAgentConfig(body);
  return NextResponse.json({ config });
}
