import 'dotenv/config';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { GmailOtpReader } from "./gmail.js";
import { SecureTokenStorage } from "./storage.js";

const server = new Server(
  { name: "resumebase-gmail-otp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

const encryptionKeyBase64 = process.env.ENCRYPTION_KEY_BASE64 || "";
const labelName = process.env.LABEL_NAME || "ResumeBase/OTP";
const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

const tokenStorage = new SecureTokenStorage({
  baseDirectoryPath: new URL("../data/", import.meta.url).pathname,
  encryptionKeyBase64,
});

const gmailReader = new GmailOtpReader({
  clientId: googleClientId,
  clientSecret: googleClientSecret,
  labelName,
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "set_refresh_token",
      description:
        "Store (encrypted) a user's Gmail OAuth2 refresh token for later OTP retrieval.",
      inputSchema: {
        type: "object",
        properties: {
          userId: { type: "string" },
          refreshToken: { type: "string" },
        },
        required: ["userId", "refreshToken"],
        additionalProperties: false,
      },
    },
    {
      name: "get_email_otp",
      description:
        "Fetch latest OTP from user's Gmail labeled messages. Optional issuer filter and maxAgeSec.",
      inputSchema: {
        type: "object",
        properties: {
          userId: { type: "string" },
          issuer: { type: "string" },
          maxAgeSec: { type: "number" },
        },
        required: ["userId"],
        additionalProperties: false,
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  if (name === "set_refresh_token") {
    const schema = z
      .object({ userId: z.string().min(1), refreshToken: z.string().min(20) })
      .strict();
    const parsed = schema.parse(args ?? {});
    if (!encryptionKeyBase64) {
      throw new Error(
        "ENCRYPTION_KEY_BASE64 not configured. Provide a 32-byte key in base64."
      );
    }
    await tokenStorage.saveRefreshToken(parsed);
    return {
      content: [{ type: "text", text: JSON.stringify({ status: "ok" }) }],
    };
  }

  if (name === "get_email_otp") {
    const schema = z
      .object({
        userId: z.string().min(1),
        issuer: z.string().optional(),
        maxAgeSec: z.number().int().positive().max(3600).optional(),
      })
      .strict();
    const parsed = schema.parse(args ?? {});

    const refreshToken = await tokenStorage.getRefreshToken({ userId: parsed.userId });
    if (!refreshToken) {
      throw new Error("No refresh token found for userId. Call set_refresh_token first.");
    }
    const result = await gmailReader.fetchLatestOtp({
      refreshToken,
      ...(parsed.issuer ? { issuer: parsed.issuer } : {}),
      ...(parsed.maxAgeSec ? { maxAgeSec: parsed.maxAgeSec } : {}),
    });
    if (!result) {
      return { content: [{ type: "text", text: JSON.stringify({ status: "not_found" }) }] };
    }
    const masked = result.code.replace(/.(?=.{2}$)/g, "*");
    console.log(`OTP fetched for user ${parsed.userId}: ${masked} from ${result.issuer ?? "unknown"}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "ok",
            code: result.code,
            receivedAt: result.receivedAt,
            issuer: result.issuer ?? null,
          }),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Tools are handled via setRequestHandler above

await server.connect(new StdioServerTransport());


