import { NextResponse } from "next/server";
import { removeGmailAccount } from "@/lib/stores/gmail-store";
import { requireAuth } from "@/lib/api-auth";

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;
  try {
    const body = await req.json();
    const email = body.email;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Missing required field: email" },
        { status: 400 }
      );
    }

    const removed = removeGmailAccount(email);

    if (!removed) {
      return NextResponse.json(
        { error: `No Gmail account found for ${email}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: `Disconnected Gmail account: ${email}`,
      email,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: `Failed to disconnect: ${message}` },
      { status: 500 }
    );
  }
}
