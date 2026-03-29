import { NextResponse } from "next/server";
import { getAllSpaces, createSpace } from "@/lib/stores/spaces-store";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;
  const spaces = getAllSpaces();
  return NextResponse.json({ spaces });
}

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  const body = await req.json();

  const space = createSpace(body);
  return NextResponse.json({ space });
}
