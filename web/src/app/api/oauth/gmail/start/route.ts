import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

function getOAuthClient(redirectUri: string) {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET env vars");
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin") || (new URL(request.url)).origin;
  const configured = process.env.GMAIL_OAUTH_REDIRECT_URI;
  const redirectUri = configured || `${origin}/api/oauth/gmail/callback`;

  const oauth2Client = getOAuthClient(redirectUri);
  const scopes = ["https://www.googleapis.com/auth/gmail.readonly", "openid", "email"];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
    include_granted_scopes: true,
  });

  return NextResponse.redirect(url, { status: 302 });
}


