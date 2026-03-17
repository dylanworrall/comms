import { NextResponse } from "next/server";
import { loadCommsEnv, saveCommsEnvVar } from "@/lib/env";

loadCommsEnv();

function maskKey(key: string): string {
  if (key.length <= 12) return "****";
  return key.slice(0, 7) + "..." + key.slice(-4);
}

export async function GET() {
  loadCommsEnv(true);

  const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.COMMS_FROM_EMAIL;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;

  return NextResponse.json({
    connected: !!googleKey,
    method: googleKey ? "api-key" : null,
    masked: googleKey ? maskKey(googleKey) : null,
    resend: {
      connected: !!resendKey,
      masked: resendKey ? maskKey(resendKey) : null,
      fromEmail: fromEmail || null,
    },
    twilio: {
      connected: !!(twilioSid && twilioToken),
      fromNumber: process.env.TWILIO_FROM_NUMBER || null,
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

  if (method === "resend") {
    return handleResend(body.resendKey, body.fromEmail);
  }

  if (method === "twilio") {
    return handleTwilio(body.twilioAccountSid, body.twilioAuthToken, body.twilioApiKeySid, body.twilioApiKeySecret);
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

async function handleResend(resendKey?: string, fromEmail?: string) {
  if (!resendKey?.trim()) {
    return NextResponse.json({ error: "Resend API key is required" }, { status: 400 });
  }

  const key = resendKey.trim();
  if (!key.startsWith("re_")) {
    return NextResponse.json(
      { error: "Invalid format. Resend keys start with re_" },
      { status: 400 }
    );
  }

  // Test by listing domains (lightweight check)
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ error: "Invalid Resend API key" }, { status: 401 });
    }
  } catch {
    // Network error — save anyway
  }

  saveCommsEnvVar("RESEND_API_KEY", key);
  process.env.RESEND_API_KEY = key;

  if (fromEmail?.trim()) {
    saveCommsEnvVar("COMMS_FROM_EMAIL", fromEmail.trim());
    process.env.COMMS_FROM_EMAIL = fromEmail.trim();
  }

  return NextResponse.json({
    success: true,
    method: "resend",
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

async function handleTwilio(accountSid?: string, authToken?: string, apiKeySid?: string, apiKeySecret?: string) {
  if (!accountSid?.trim()) {
    return NextResponse.json({ error: "Twilio Account SID is required" }, { status: 400 });
  }
  if (!authToken?.trim()) {
    return NextResponse.json({ error: "Twilio Auth Token is required" }, { status: 400 });
  }

  const sid = accountSid.trim();
  const token = authToken.trim();

  // Test by fetching account info
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      },
    });
    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ error: "Invalid Twilio credentials" }, { status: 401 });
    }
  } catch {
    // Network error — save anyway
  }

  saveCommsEnvVar("TWILIO_ACCOUNT_SID", sid);
  process.env.TWILIO_ACCOUNT_SID = sid;

  saveCommsEnvVar("TWILIO_AUTH_TOKEN", token);
  process.env.TWILIO_AUTH_TOKEN = token;

  if (apiKeySid?.trim()) {
    saveCommsEnvVar("TWILIO_API_KEY_SID", apiKeySid.trim());
    process.env.TWILIO_API_KEY_SID = apiKeySid.trim();
  }

  if (apiKeySecret?.trim()) {
    saveCommsEnvVar("TWILIO_API_KEY_SECRET", apiKeySecret.trim());
    process.env.TWILIO_API_KEY_SECRET = apiKeySecret.trim();
  }

  return NextResponse.json({
    success: true,
    method: "twilio",
    maskedSid: maskKey(sid),
  });
}
