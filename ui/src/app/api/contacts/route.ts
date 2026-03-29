import { NextResponse } from "next/server";
import { getAllContacts, addContact, searchContacts } from "@/lib/stores/contacts";
import { requireAuth } from "@/lib/api-auth";

export async function GET(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;
  const url = new URL(req.url);
  const query = url.searchParams.get("q");

  if (query) {
    return NextResponse.json({ contacts: searchContacts(query) });
  }
  return NextResponse.json({ contacts: getAllContacts() });
}

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  const body = await req.json();

  const contact = addContact(body);
  return NextResponse.json({ contact });
}
