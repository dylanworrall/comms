import { NextResponse } from "next/server";
import { getAllContacts, addContact, searchContacts } from "@/lib/stores/contacts";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("q");
  if (query) {
    return NextResponse.json({ contacts: searchContacts(query) });
  }
  return NextResponse.json({ contacts: getAllContacts() });
}

export async function POST(req: Request) {
  const body = await req.json();
  const contact = addContact(body);
  return NextResponse.json({ contact });
}
