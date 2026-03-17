import { NextResponse } from "next/server";
import { loadCommsEnv, saveCommsEnvVar } from "@/lib/env";

loadCommsEnv();

/**
 * GET: Return LiveKit connection status
 * POST: Save LiveKit credentials
 */
export async function GET() {
  loadCommsEnv(true);

  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  return NextResponse.json({
    connected: !!(url && apiKey && apiSecret),
    url: url || null,
    sipEndpoint: url ? url.replace("wss://", "").replace("https://", "") : null,
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { livekitUrl, livekitApiKey, livekitApiSecret } = body as {
    livekitUrl?: string;
    livekitApiKey?: string;
    livekitApiSecret?: string;
  };

  if (!livekitUrl?.trim() || !livekitApiKey?.trim() || !livekitApiSecret?.trim()) {
    return NextResponse.json(
      { error: "All LiveKit credentials are required" },
      { status: 400 }
    );
  }

  // Save credentials
  saveCommsEnvVar("LIVEKIT_URL", livekitUrl.trim());
  saveCommsEnvVar("LIVEKIT_API_KEY", livekitApiKey.trim());
  saveCommsEnvVar("LIVEKIT_API_SECRET", livekitApiSecret.trim());

  process.env.LIVEKIT_URL = livekitUrl.trim();
  process.env.LIVEKIT_API_KEY = livekitApiKey.trim();
  process.env.LIVEKIT_API_SECRET = livekitApiSecret.trim();

  return NextResponse.json({
    success: true,
    url: livekitUrl.trim(),
  });
}
