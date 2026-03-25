import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/stores/settings";
import { getConvexClient, isConvexMode } from "@/lib/convex-server";
import { api } from "@/lib/convex-api";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;
  if (isConvexMode()) {
    const convex = getConvexClient()!;
    const settings = await convex.query(api.settings.get, {});
    return NextResponse.json(settings);
  }
  return NextResponse.json(getSettings());
}

export async function POST(req: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  const body = await req.json();

  if (isConvexMode()) {
    const convex = getConvexClient()!;
    const updated = await convex.mutation(api.settings.update, body);
    return NextResponse.json(updated);
  }

  const updated = updateSettings(body);
  return NextResponse.json(updated);
}
