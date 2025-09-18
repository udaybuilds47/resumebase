import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { encryptToBase64 } from "@/lib/crypto";

function getOAuthClient(redirectUri: string) {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET env vars");
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function GET(request: NextRequest) {
  try {
    const origin = request.headers.get("origin") || (new URL(request.url)).origin;
    const configured = process.env.GMAIL_OAUTH_REDIRECT_URI;
    const redirectUri = configured || `${origin}/api/oauth/gmail/callback`;
    const oauth2Client = getOAuthClient(redirectUri);

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });

    const { tokens } = await oauth2Client.getToken(code);
    const refresh = tokens.refresh_token;
    if (!refresh) {
      return NextResponse.json({ error: "no refresh_token returned" }, { status: 400 });
    }

    const enc = encryptToBase64(refresh);
    const res = NextResponse.redirect(`${origin}/?gmail=connected`);
    // httpOnly, secure in prod, 30 days
    res.cookies.set("gmail_rt", enc, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "callback failed" }, { status: 500 });
  }
}


