import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { decryptFromBase64 } from "@/lib/crypto";

function getOAuthClient() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Missing GMAIL_CLIENT_ID/SECRET");
  return new google.auth.OAuth2(clientId, clientSecret);
}

function decodeBase64Url(data?: string | null): string {
  if (!data) return "";
  const norm = data.replace(/-/g, "+").replace(/_/g, "/");
  try { return Buffer.from(norm, "base64").toString("utf8"); } catch { return ""; }
}

function extractOtp(text: string): string | null {
  const patterns = [
    // Numeric codes
    /(security\s*code|verification\s*code|code|otp|pin)[^A-Za-z0-9]{0,10}(\d{4,8})/i,
    /(\d{6})\s*(is your|verification|code)/i,
    /verify[^A-Za-z0-9]{0,20}(\d{4,8})/i,
    /(\d{4,8})\s*to\s*(verify|confirm|login)/i,
    // Alphanumeric codes (6-10 base62) near keywords
    /(security\s*code|verification\s*code|code)[^A-Za-z0-9]{0,20}([A-Za-z0-9]{6,10})/i,
    /copy\s*and\s*paste[^A-Za-z0-9]{0,20}([A-Za-z0-9]{6,10})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[m.length - 1];
  }
  return null;
}

async function llmExtractOtp(content: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GOOGLE_OTP_MODEL || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const prompt = [
    "You extract one-time security/verification codes from short email text.",
    "Rules:",
    "- Return only the code string if confident, else return null.",
    "- Codes are typically 4–10 characters, numeric or alphanumeric (A–Z, a–z, 0–9).",
    "- Prefer strings near phrases like 'security code', 'verification code', 'code', 'OTP'.",
    "- Do not include quotes, spaces, or additional text.",
  ].join("\n");
  const trimmed = content.slice(0, 6000);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: prompt }] },
          { role: 'user', parts: [{ text: trimmed }] },
        ],
        generationConfig: { temperature: 0 }
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
    const m = text.match(/[A-Za-z0-9]{4,10}/);
    return m ? m[0] : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const issuer = (searchParams.get("issuer") || "").trim();
    const minutes = Math.max(1, Math.min(30, parseInt(searchParams.get("windowMin") || "10")));
    const noFrom = searchParams.get("noFrom") === "1";
    const keywordsParam = searchParams.get("keywords");
    const keywords = keywordsParam?.trim() ? keywordsParam : "security code OR verification OR code OR passcode OR otp OR login";

    // Resolve refresh token: header 'x-gmail-rt' (encrypted cookie value) first,
    // then cookie (when called from browser), then env fallback
    const encHeader = request.headers.get('x-gmail-rt') || undefined;
    const encCookie = request.cookies.get("gmail_rt")?.value;
    const enc = encHeader || encCookie;
    const refresh = enc ? decryptFromBase64(enc) : (process.env.GMAIL_REFRESH_TOKEN || "");
    if (!refresh) return NextResponse.json({ code: null, error: "Missing Gmail auth" }, { status: 401 });

    const auth = getOAuthClient();
    auth.setCredentials({ refresh_token: refresh });
    const gmail = google.gmail({ version: "v1", auth });

    const query = [
      `newer_than:${minutes}m`,
      "-in:spam",
      issuer && !noFrom ? `from:(${issuer})` : "",
      `subject:(${keywords})`,
    ].filter(Boolean).join(" ");

    const list = await gmail.users.messages.list({ userId: "me", q: query, maxResults: 10 });
    const messages = list.data.messages || [];

    for (const m of messages) {
      const msg = await gmail.users.messages.get({ userId: "me", id: m.id! });
      const payload = msg.data.payload;
      const headers = (payload?.headers || []) as Array<{ name?: string; value?: string }>;
      const subject = headers.find(h => h.name?.toLowerCase() === "subject")?.value || "";
      const from = headers.find(h => h.name?.toLowerCase() === "from")?.value || "";

      let text = "";
      let htmlText = "";
      const mimeType = payload?.mimeType || "";
      if (mimeType === "text/plain") text = decodeBase64Url(payload?.body?.data);
      else {
        const parts = (payload?.parts || []) as Array<{ mimeType?: string; body?: { data?: string }; parts?: any[] }>;
        const stack = [...parts];
        while (stack.length) {
          const p = stack.shift()!;
          if (p.mimeType === "text/plain" && p.body?.data) text += "\n" + decodeBase64Url(p.body.data);
          if (p.mimeType === "text/html" && p.body?.data) htmlText += "\n" + decodeBase64Url(p.body.data);
          if (p.parts) stack.push(...(p.parts as any[]));
        }
      }

      const combined = `${subject}\n${text}\n${htmlText.replace(/<[^>]+>/g, ' ')}`;
      let otp = extractOtp(combined);
      if (!otp) {
        otp = await llmExtractOtp(combined);
      }
      if (otp) return NextResponse.json({ code: otp, issuer, from, subject });
    }

    return NextResponse.json({ code: null });
  } catch (e: any) {
    return NextResponse.json({ code: null, error: e?.message || "otp fetch failed" }, { status: 500 });
  }
}


