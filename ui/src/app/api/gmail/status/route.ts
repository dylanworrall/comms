import { NextResponse } from "next/server";
import {
  getGmailAccounts,
  getDefaultGmailAccount,
} from "@/lib/stores/gmail-store";

export async function GET() {
  const accounts = getGmailAccounts();
  const defaultAccount = getDefaultGmailAccount();

  return NextResponse.json({
    connected: accounts.length > 0,
    accounts: accounts.map((a) => a.email),
    defaultAccount: defaultAccount?.email ?? null,
  });
}
