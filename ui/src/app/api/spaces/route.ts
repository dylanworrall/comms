import { NextResponse } from "next/server";
import { getAllSpaces, createSpace } from "@/lib/stores/spaces-store";

export async function GET() {
  const spaces = getAllSpaces();
  return NextResponse.json({ spaces });
}

export async function POST(req: Request) {
  const body = await req.json();
  const space = createSpace(body);
  return NextResponse.json({ space });
}
