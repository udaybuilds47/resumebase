import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  const redirectUri = `${base}/api/auth/gmail/callback`;
  const scope = encodeURIComponent("https://www.googleapis.com/auth/gmail.readonly");
  const state = encodeURIComponent("rb" );
  const url =
    `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&access_type=offline&prompt=consent&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${scope}` +
    `&state=${state}`;
  return NextResponse.redirect(url);
}


