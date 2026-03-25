import { NextResponse } from "next/server";
import { getAllContacts, addContact, searchContacts } from "@/lib/stores/contacts";
import { getConvexClient, isConvexMode } from "@/lib/convex-server";
import { api } from "@/lib/convex-api";
import { requireAuth } from "@/lib/api-auth";

export async function GET(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;
  const url = new URL(req.url);
  const query = url.searchParams.get("q");

  if (isConvexMode()) {
    const convex = getConvexClient()!;
    if (query) {
      const contacts = await convex.query(api.contacts.search, { query });
      return NextResponse.json({ contacts });
    }
    const contacts = await convex.query(api.contacts.list, {});
    return NextResponse.json({ contacts });
  }

  if (query) {
    return NextResponse.json({ contacts: searchContacts(query) });
  }
  return NextResponse.json({ contacts: getAllContacts() });
}

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  const body = await req.json();

  if (isConvexMode()) {
    const convex = getConvexClient()!;
    const id = await convex.mutation(api.contacts.add, body);
    return NextResponse.json({ contact: { _id: id, ...body } });
  }

  const contact = addContact(body);
  return NextResponse.json({ contact });
}
