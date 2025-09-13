import { NextRequest, NextResponse } from "next/server";
export const runtime = 'nodejs';
import path from "node:path";
import fs from "node:fs/promises";
import { createSecretKey } from "node:crypto";
import { CompactEncrypt } from "jose";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const userId = url.searchParams.get("userId") || "local"; // TODO: tie to real user session
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  const base = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${base}/api/auth/gmail/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return NextResponse.json({ error: "Token exchange failed", details: text }, { status: 500 });
  }
  const tokens = await tokenRes.json();
  const refreshToken = tokens.refresh_token as string | undefined;
  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh_token returned; ensure prompt=consent & access_type=offline" }, { status: 400 });
  }

  // Store refresh token directly in MCP data dir using same encryption as MCP
  const keyB64 = process.env.ENCRYPTION_KEY_BASE64 || "";
  if (keyB64.length === 0) {
    return NextResponse.json({ error: "Missing ENCRYPTION_KEY_BASE64" }, { status: 500 });
  }
  const keyBytes = Buffer.from(keyB64, "base64");
  if (keyBytes.length !== 32) {
    return NextResponse.json({ error: "ENCRYPTION_KEY_BASE64 must decode to 32 bytes" }, { status: 500 });
  }
  const jwe = await new CompactEncrypt(new TextEncoder().encode(refreshToken))
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(createSecretKey(keyBytes));

  const workspaceRoot = path.resolve(process.cwd(), "..");
  const dataDir = path.join(workspaceRoot, "mcp", "data");
  await fs.mkdir(dataDir, { recursive: true });
  const filePath = path.join(dataDir, `${userId.replace(/[^a-zA-Z0-9_-]/g, "_")}.token`);
  await fs.writeFile(filePath, jwe, { encoding: "utf8" });

  return NextResponse.redirect(`${base}/?gmail=connected`);
}


