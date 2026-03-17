import { NextResponse } from "next/server";
import { google } from "googleapis";
import { loadCommsEnv } from "@/lib/env";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/userinfo.email",
];

export async function GET(req: Request) {
  loadCommsEnv();

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error:
          "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET. Set them in ~/.comms/.env or as environment variables.",
      },
      { status: 500 }
    );
  }

  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/gmail/callback`;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: origin,
  });

  return NextResponse.redirect(authUrl);
}
