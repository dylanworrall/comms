import { NextResponse } from "next/server";
import { google } from "googleapis";
import { loadCommsEnv } from "@/lib/env";
import { saveGmailAccount } from "@/lib/stores/gmail-store";

export async function GET(req: Request) {
  loadCommsEnv();

  const url = new URL(req.url);
  const origin = url.searchParams.get("state") || process.env.NEXT_PUBLIC_APP_URL || url.origin;
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${origin}/settings?gmail=error&reason=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/settings?gmail=error&reason=no_code`
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${origin}/settings?gmail=error&reason=missing_credentials`
    );
  }

  const redirectUri = `${origin}/api/gmail/callback`;

  try {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        `${origin}/settings?gmail=error&reason=no_refresh_token`
      );
    }

    // Set credentials so we can fetch user info
    oauth2Client.setCredentials(tokens);

    // Get user email
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;

    if (!email) {
      return NextResponse.redirect(
        `${origin}/settings?gmail=error&reason=no_email`
      );
    }

    // Save to gmail store
    saveGmailAccount({
      email,
      accessToken: tokens.access_token || "",
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date || Date.now() + 3600 * 1000,
      scope: tokens.scope || "",
    });

    return NextResponse.redirect(
      `${origin}/settings?gmail=connected&account=${encodeURIComponent(email)}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.redirect(
      `${origin}/settings?gmail=error&reason=${encodeURIComponent(message)}`
    );
  }
}
