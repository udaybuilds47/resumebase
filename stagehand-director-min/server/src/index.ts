// src/index.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import Browserbase from "@browserbasehq/sdk";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "127.0.0.1";

const SYSTEM_PROMPT = [
  "Don't ask any questions, just do the task.",
  "Never attempt to bypass login, paywalls, CAPTCHA, or MFA.",
  "Prefer robust actions by visible text/role over brittle CSS selectors.",
  "When the task implies a list, return strictly JSON (no prose).", 
  "Once you've produced the requested JSON, issue a 'close' step and stop.",
].join("\n");

async function build() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  // Accept raw uploads
  app.addContentTypeParser("application/octet-stream", { parseAs: "buffer" }, (_req, body, done) => done(null, body));
  app.addContentTypeParser("application/pdf", { parseAs: "buffer" }, (_req, body, done) => done(null, body));

  // Keep Stagehand instances in-memory to support a two-step flow
  const stagehandBySession = new Map<string, any>();

  // Create a session and return viewer URL (does NOT start the agent)
  app.post("/session", async (req, reply) => {
    const body = (req.body ?? {}) as { prompt?: string; delayStartMs?: number };
    const instruction = (body.prompt || "").trim();
    if (!instruction) return reply.code(400).send({ error: "Missing prompt" });

    try {
      const { Stagehand } = await import("@browserbasehq/stagehand");

      const modelName =
        process.env.GOOGLE_MODEL || process.env.OPENAI_MODEL || "openai/gpt-4o-mini";
      const modelClientOptions = modelName.startsWith("google/")
        ? { apiKey: process.env.GOOGLE_API_KEY! }
        : { apiKey: process.env.OPENAI_API_KEY! };

      const stagehand = new Stagehand({
        env: "BROWSERBASE",
        apiKey: process.env.BROWSERBASE_API_KEY!,
        projectId: process.env.BROWSERBASE_PROJECT_ID!,
        modelName,
        modelClientOptions,
        systemPrompt: SYSTEM_PROMPT,
        // keep default logging; we don't capture/forward it
      });

      const { sessionId, sessionUrl, debugUrl } = await stagehand.init();

      // Prefer an iframe-friendly fullscreen debugger URL when available
      let viewerUrl: string | null = sessionUrl ?? debugUrl ?? null;
      try {
        if (sessionId) {
          const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });
          const dbg = await bb.sessions.debug(sessionId);
          viewerUrl = dbg?.debuggerFullscreenUrl ?? dbg?.debuggerUrl ?? viewerUrl;
        }
      } catch {
        // ignore; we'll just use sessionUrl/debugUrl
      }

      // Save for later /run
      if (sessionId) stagehandBySession.set(sessionId, stagehand);

      // Respond so the client can render the live view and upload files
      reply.send({ runId: crypto.randomUUID(), sessionId, viewerUrl });

      // Define a custom tool the agent can use when it needs to upload/attach a file
      const uploadAndAttachTool = {
        name: "upload_and_attach_file",
        description:
          "Attach a file to a file input on the page using Playwright setInputFiles payload. Provide localFilePath (server path), or leave empty to automatically use a file previously uploaded for this session.",
        parameters: {
          type: "object",
          properties: {
            localFilePath: { type: "string", description: "Absolute path on server to read (e.g., /tmp/.server_uploads/<sessionId>/resume.pdf). If omitted, the tool will select the first file uploaded for this session." },
            selector: { type: "string", description: "CSS selector for the <input type=\\\"file\\\"> element" },
            url: { type: "string", description: "Optional URL to navigate before attaching the file" },
          },
          required: ["selector"],
        },
        // Handler invoked when the agent chooses this tool
        execute: async (args: { localFilePath?: string; selector: string; url?: string }) => {
          app.log.info({
            msg: "tool:upload_and_attach_file:start",
            hasLocalFilePath: !!args.localFilePath,
            selector: args.selector,
            url: args.url,
          });
          // Wait 10s to ensure any prior upload has completed and the page is ready
          await new Promise<void>((resolve) => setTimeout(resolve, 10_000));
          const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });
          // Resolve local file path: use provided path or auto-detect from server uploads dir
          let localPath = args.localFilePath;

          // Connect to the same session and attach via CDP
          const session = await bb.sessions.retrieve(sessionId! as string);
          if (!session?.connectUrl) throw new Error("connectUrl not available for session");

          const browser = await chromium.connectOverCDP(session.connectUrl);
          const context = browser.contexts()[0]!;
          const page = context.pages()[0] ?? (await context.newPage());

          if (args.url) {
            await page.goto(args.url, { waitUntil: "domcontentloaded" });
          }

          if (!localPath) {
            const uploadsDir = path.join("/tmp/.server_uploads", sessionId!);
            try {
              const files = await fs.promises.readdir(uploadsDir);
              const first = files[0];
              if (!first) throw new Error("No uploaded files found for this session");
              localPath = path.join(uploadsDir, first);
            } catch (e) {
              throw new Error("Missing localFilePath and no server uploads found for session");
            }
          }
          const ensuredLocalPath = localPath!;

          const locator = page.locator(args.selector);
          const basename = path.basename(ensuredLocalPath);
          const ext = basename.split(".").pop()?.toLowerCase();
          const mimeType =
            ext === "pdf" ? "application/pdf" :
            ext === "png" ? "image/png" :
            ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
            ext === "txt" ? "text/plain" :
            "application/octet-stream";
          const buffer = await fs.promises.readFile(ensuredLocalPath);
          await locator.setInputFiles({ name: basename, mimeType, buffer });
          app.log.info({ msg: "tool:upload_and_attach_file:setInputFiles_payload", name: basename, localPath });
          return { attached: true, via: "payload", localPath } as any;
        },
      } as const;

      // Do not start the agent here. /run endpoint will start it after uploads complete
    } catch (e: any) {
      return reply.code(500).send({ error: e?.message || "Failed to start" });
    }
  });

  // Start the agent for an existing session (created via /session)
  app.post("/run", async (req, reply) => {
    const body = (req.body ?? {}) as { sessionId?: string; prompt?: string; delayStartMs?: number };
    const { sessionId } = body;
    const instruction = (body.prompt || "").trim();
    if (!sessionId) return reply.code(400).send({ error: "Missing sessionId" });
    if (!instruction) return reply.code(400).send({ error: "Missing prompt" });

    const stagehand = stagehandBySession.get(sessionId);
    if (!stagehand) return reply.code(404).send({ error: "Unknown sessionId" });

    try {
      // Recreate the tool (bound to this session)
      const uploadAndAttachTool = {
        name: "upload_and_attach_file",
        description:
          "Attach a file to a file input on the page using Playwright setInputFiles payload. Provide localFilePath (server path), or leave empty to automatically use a file previously uploaded for this session.",
        parameters: {
          type: "object",
          properties: {
            localFilePath: { type: "string", description: "Absolute path on server to read (e.g., /tmp/.server_uploads/<sessionId>/resume.pdf). If omitted, the tool will select the first file uploaded for this session." },
            selector: { type: "string", description: "CSS selector for the <input type=\\\"file\\\"> element" },
            url: { type: "string", description: "Optional URL to navigate before attaching the file" },
          },
          required: ["selector"],
        },
        execute: async (args: { localFilePath?: string; selector: string; url?: string }) => {
          app.log.info({ msg: "tool:upload_and_attach_file:start", hasLocalFilePath: !!args.localFilePath, selector: args.selector, url: args.url });
          await new Promise<void>((resolve) => setTimeout(resolve, 10_000));
          const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });
          const session = await bb.sessions.retrieve(sessionId as string);
          if (!session?.connectUrl) throw new Error("connectUrl not available for session");
          const browser = await chromium.connectOverCDP(session.connectUrl);
          const context = browser.contexts()[0]!;
          const page = context.pages()[0] ?? (await context.newPage());
          if (args.url) await page.goto(args.url, { waitUntil: "domcontentloaded" });
          let localPath = args.localFilePath;
          if (!localPath) {
            const uploadsDir = path.join("/tmp/.server_uploads", sessionId);
            const files = await fs.promises.readdir(uploadsDir).catch(() => [] as string[]);
            const first = files[0];
            if (!first) throw new Error("No uploaded files found for this session");
            localPath = path.join(uploadsDir, first);
          }
          const locator = page.locator(args.selector);
          const basename = path.basename(localPath);
          const ext = basename.split(".").pop()?.toLowerCase();
          const mimeType = ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "txt" ? "text/plain" : "application/octet-stream";
          const buffer = await fs.promises.readFile(localPath);
          await locator.setInputFiles({ name: basename, mimeType, buffer });
          app.log.info({ msg: "tool:upload_and_attach_file:setInputFiles_payload", name: basename, localPath });
          return { attached: true, via: "payload", localPath } as any;
        },
      } as const;

      const startDelayMs = Math.max(0, Number(body.delayStartMs ?? 0));
      queueMicrotask(async () => {
        const run = async () => {
          try {
            const operator = (stagehand as any).agent({ tools: [uploadAndAttachTool] });
            app.log.info({ msg: "agent:start", sessionId, instruction });
            await operator.execute({ instruction, maxSteps: 25, autoScreenshot: true });
            app.log.info({ msg: "agent:finished", sessionId });
          } catch (e: any) {
            app.log.error({ msg: "agent:error", err: e?.message || e, sessionId });
          } finally {
            const graceMs = Number(process.env.SESSION_GRACE_MS ?? 120000);
            setTimeout(() => {
              stagehand.close().catch((e: any) => app.log.error({ msg: "stagehand:close:error", err: e?.message || e }));
              stagehandBySession.delete(sessionId);
            }, graceMs);
          }
        };
        if (startDelayMs > 0) setTimeout(run, startDelayMs); else run();
      });
      reply.send({ started: true });
    } catch (e: any) {
      return reply.code(500).send({ error: e?.message || "Failed to run" });
    }
  });

  // Upload a local file into an existing session; returns remote path
  // Accepts raw body (application/octet-stream). Provide filename via query (?filename=resume.pdf)
  app.post("/uploads/:sessionId", async (req, reply) => {
    try {
      const { sessionId } = req.params as { sessionId: string };
      if (!sessionId) return reply.code(400).send({ error: "Missing session ID" });

      const url = new URL(req.url, `http://${req.headers.host}`);
      const fileName = (url.searchParams.get("filename") || "upload.bin").replace(/[^\w.\-]/g, "_");

      const buf: Buffer = (req.body as Buffer) ?? Buffer.alloc(0);
      const tmpDir = fs.mkdtempSync(path.join(process.cwd(), "upload-"));
      const localPath = path.join(tmpDir, fileName);
      await fs.promises.writeFile(localPath, Buffer.from(buf));

      const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });
      const fileStream = fs.createReadStream(localPath);
      await bb.sessions.uploads.create(sessionId, { file: fileStream });

      // Also persist a server-side copy for the tool's localFilePath mode
      try {
        const serverUploadsDir = path.join("/tmp/.server_uploads", sessionId);
        await fs.promises.mkdir(serverUploadsDir, { recursive: true });
        const serverCopyPath = path.join(serverUploadsDir, fileName);
        await fs.promises.copyFile(localPath, serverCopyPath);
      } catch {}

      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

      const remotePath = `/tmp/.uploads/${fileName}`;
      return reply.send({ remotePath, fileName });
    } catch (e: any) {
      return reply.code(500).send({ error: e?.message || "Upload failed" });
    }
  });

  // Attach an uploaded file to a file input inside the live session using CDP
  app.post("/attach", async (req, reply) => {
    try {
      const body = (req.body ?? {}) as {
        sessionId?: string;
        url: string;
        selector: string;
        remotePath: string; // e.g., /tmp/.uploads/resume.pdf
      };

      const { sessionId, url, selector, remotePath } = body;
      if (!sessionId || !url || !selector || !remotePath) {
        return reply.code(400).send({ error: "Missing sessionId, url, selector, or remotePath" });
      }

      const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });
      // Retrieve session to get connect URL
      const session = await bb.sessions.retrieve(sessionId as string);
      if (!session?.connectUrl) return reply.code(400).send({ error: "connectUrl not available for session" });

      const browser = await chromium.connectOverCDP(session.connectUrl);
      const context = browser.contexts()[0]!;
      const page = context.pages()[0] ?? (await context.newPage());
      await page.goto(url, { waitUntil: "domcontentloaded" });

      const cdp = await context.newCDPSession(page);
      const { root } = await cdp.send("DOM.getDocument");
      const queried = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
      if (!queried?.nodeId) return reply.code(400).send({ error: "Selector did not resolve to a node" });
      await cdp.send("DOM.setFileInputFiles", { files: [remotePath], nodeId: queried.nodeId });

      return reply.send({ attached: true });
    } catch (e: any) {
      return reply.code(500).send({ error: e?.message || "Attach failed" });
    }
  });

  // Get session recording for replay
  app.get("/recording/:sessionId", async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    
    if (!sessionId) {
      return reply.code(400).send({ error: "Missing session ID" });
    }

    try {
      const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });
      const recording = await bb.sessions.recording.retrieve(sessionId);
      
      // Wrap the recording data in the expected format for the frontend
      reply.send({ events: recording });
    } catch (e: any) {
      return reply.code(500).send({ error: e?.message || "Failed to retrieve recording" });
    }
  });

  return app;
}

build().then(app =>
  app.listen({ port: PORT, host: HOST }).then(() => {
    app.log.info(`Stagehand server → http://${HOST}:${PORT}`);
  })
);