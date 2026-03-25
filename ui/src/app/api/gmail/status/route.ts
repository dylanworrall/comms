import { NextResponse } from "next/server";
import {
  getGmailAccounts,
  getDefaultGmailAccount,
} from "@/lib/stores/gmail-store";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;
  const accounts = getGmailAccounts();
  const defaultAccount = getDefaultGmailAccount();

  return NextResponse.json({
    connected: accounts.length > 0,
    accounts: accounts.map((a) => a.email),
    defaultAccount: defaultAccount?.email ?? null,
  });
}
