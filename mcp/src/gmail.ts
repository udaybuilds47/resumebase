import { google } from "googleapis";

export interface GmailOtpReaderOptions {
  clientId: string;
  clientSecret: string;
  labelName: string;
}

export interface FetchLatestOtpParams {
  refreshToken: string;
  issuer?: string;
  maxAgeSec?: number;
}

export type OtpResult = { code: string; receivedAt: string } &
  (| { issuer: string } | { issuer?: undefined });

export class GmailOtpReader {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly labelName: string;

  constructor(options: GmailOtpReaderOptions) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.labelName = options.labelName;
  }

  async fetchLatestOtp(params: FetchLatestOtpParams): Promise<OtpResult | null> {
    const { refreshToken, issuer, maxAgeSec = 600 } = params;

    const oauth2Client = new google.auth.OAuth2(this.clientId, this.clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const newerThan = Math.max(1, Math.floor(maxAgeSec / 60));

    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: `label:"${this.labelName}" newer_than:${newerThan}m`,
      maxResults: 5,
    });

    const messages = listRes.data.messages || [];
    if (messages.length === 0) return null;

    // Fetch details for up to 5 messages, newest first
    const detailed = await Promise.all(
      messages.map((m) =>
        m.id
          ? gmail.users.messages.get({ userId: "me", id: m.id, format: "full" })
          : Promise.resolve(null as any)
      )
    );

    const otpRegexes: RegExp[] = [
      /\b(\d{6,8})\b/, // 6-8 digits
      /\b([A-Z0-9]{6,8})\b/i, // 6-8 alphanumeric
      /OTP\s*[:=-]?\s*([A-Z0-9]{4,8})/i,
      /code\s*[:=-]?\s*([A-Z0-9]{4,8})/i,
    ];

    for (const res of detailed) {
      if (!res || !res.data) continue;
      const msg = res.data;

      const headers = Object.fromEntries(
        (msg.payload?.headers || []).map((h: { name?: string; value?: string }) => [
          h.name?.toLowerCase() || "",
          h.value || "",
        ])
      );
      const from = headers["from"] || "";
      const subject = headers["subject"] || "";
      const dateHeader = headers["date"] || new Date().toUTCString();
      const receivedAt = new Date(dateHeader).toISOString();

      if (issuer) {
        const hay = `${from} ${subject}`.toLowerCase();
        if (!hay.includes(issuer.toLowerCase())) continue;
      }

      const bodyText = extractPlainText(msg);

      for (const re of otpRegexes) {
        const m = bodyText.match(re);
        if (m && m[1]) {
          const issuerVal = parseIssuer(from, subject);
          return {
            code: m[1],
            receivedAt,
            ...(issuerVal ? { issuer: issuerVal } : {}),
          };
        }
      }
    }
    return null;
  }
}

function extractPlainText(message: any): string {
  const parts: any[] = [];

  function walk(part: any) {
    if (!part) return;
    if (part.mimeType === "text/plain" && part.body?.data) {
      parts.push(Buffer.from(part.body.data, "base64").toString("utf8"));
    } else if (part.mimeType === "text/html" && part.body?.data) {
      const html = Buffer.from(part.body.data, "base64").toString("utf8");
      parts.push(stripHtml(html));
    }
    (part.parts || []).forEach(walk);
  }

  walk(message.payload);

  if (parts.length === 0 && message.snippet) {
    parts.push(message.snippet);
  }

  return parts.join("\n");
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function parseIssuer(from: string, subject: string): string | undefined {
  const emailMatch = from.match(/<([^>]+)>/);
  const sender = emailMatch?.[1] ?? from;
  const domainMatch = sender.match(/@([\w.-]+)/);
  const domain = domainMatch ? domainMatch[1] : undefined;
  if (domain) return domain;
  if (subject) return subject.split(" ").slice(0, 5).join(" ");
  return undefined;
}


