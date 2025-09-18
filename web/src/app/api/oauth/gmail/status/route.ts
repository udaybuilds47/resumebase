import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const has = Boolean(request.cookies.get("gmail_rt")?.value);
  return NextResponse.json({ connected: has });
}


