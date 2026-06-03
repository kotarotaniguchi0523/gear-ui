import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    envKeySet: !!process.env.ANTHROPIC_API_KEY?.trim(),
  });
}
