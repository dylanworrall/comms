import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/stores/settings";

export async function GET() {
  return NextResponse.json(getSettings());
}

export async function POST(req: Request) {
  const body = await req.json();
  const updated = updateSettings(body);
  return NextResponse.json(updated);
}
