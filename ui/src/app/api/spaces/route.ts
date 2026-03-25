import { NextResponse } from "next/server";
import { getAllSpaces, createSpace } from "@/lib/stores/spaces-store";
import { getConvexClient, isConvexMode } from "@/lib/convex-server";
import { api } from "@/lib/convex-api";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;
  if (isConvexMode()) {
    const convex = getConvexClient()!;
    const spaces = await convex.query(api.spaces.list, {});
    return NextResponse.json({ spaces });
  }
  const spaces = getAllSpaces();
  return NextResponse.json({ spaces });
}

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  const body = await req.json();

  if (isConvexMode()) {
    const convex = getConvexClient()!;
    const space = await convex.mutation(api.spaces.create, body);
    return NextResponse.json({ space });
  }

  const space = createSpace(body);
  return NextResponse.json({ space });
}
