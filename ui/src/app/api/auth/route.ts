import { NextResponse } from "next/server";
import { loadCommsEnv, saveCommsEnvVar } from "@/lib/env";

loadCommsEnv();

function maskKey(key: string): string {
  if (key.length <= 12) return "****";
  return key.slice(0, 7) + "..." + key.slice(-4);
}

export async function GET() {
  loadCommsEnv(true);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const oauthToken = process.env.CLAUDE_OAUTH_TOKEN;
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.COMMS_FROM_EMAIL;

  return NextResponse.json({
    connected: !!(apiKey || oauthToken),
    method: apiKey ? "api-key" : oauthToken ? "setup-token" : null,
    masked: apiKey ? maskKey(apiKey) : oauthToken ? maskKey(oauthToken) : null,
    resend: {
      connected: !!resendKey,
      masked: resendKey ? maskKey(resendKey) : null,
      fromEmail: fromEmail || null,
    },
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { method } = body as { method: string };

  if (method === "api-key") {
    return handleApiKey(body.apiKey);
  }

  if (method === "setup-token") {
    return handleSetupToken(body.token);
  }

  return NextResponse.json({ error: "Invalid method" }, { status: 400 });
}

async function handleApiKey(apiKey?: string) {
  if (!apiKey?.trim()) {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }

  const key = apiKey.trim();

  if (!key.startsWith("sk-ant-")) {
    return NextResponse.json(
      { error: "Invalid format. API keys start with sk-ant-" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    if (res.status === 401) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }
  } catch {
    // Network error — save anyway, user can retry
  }

  saveCommsEnvVar("ANTHROPIC_API_KEY", key);
  process.env.ANTHROPIC_API_KEY = key;

  return NextResponse.json({
    success: true,
    method: "api-key",
    masked: maskKey(key),
  });
}

async function handleSetupToken(token?: string) {
  if (!token?.trim()) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  const trimmed = token.trim();

  // Test against Anthropic API with Bearer auth
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${trimmed}`,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "oauth-2025-04-20",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json(
        { error: "Token rejected. Anthropic may restrict subscription tokens for non-Claude Code use. Try an API key instead." },
        { status: 401 }
      );
    }
  } catch {
    // Network error — save anyway
  }

  saveCommsEnvVar("CLAUDE_OAUTH_TOKEN", trimmed);
  process.env.CLAUDE_OAUTH_TOKEN = trimmed;

  return NextResponse.json({
    success: true,
    method: "setup-token",
    masked: maskKey(trimmed),
  });
}
