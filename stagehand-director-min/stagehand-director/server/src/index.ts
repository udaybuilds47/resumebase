// src/index.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import Browserbase from "@browserbasehq/sdk";
import crypto from "node:crypto";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "127.0.0.1";

const ALLOWLIST = (process.env.ALLOWLIST ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const SYSTEM_PROMPT = [
  ALLOWLIST.length
    ? `Only navigate within these domains (and their subpaths): ${ALLOWLIST.join(", ")}.`
    : `Before navigating anywhere, ask the user for an allowed domain.`,
  "If required info is missing, ask before proceeding.",
  "Never attempt to bypass login, paywalls, CAPTCHA, or MFA.",
  "Prefer robust actions by visible text/role over brittle CSS selectors.",
  "When the task implies a list, return strictly JSON (no prose).",
  "Once you've produced the requested JSON, issue a 'close' step and stop.",
].join("\n");

async function build() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  // Start a run and return the live viewer URL right away.
  app.post("/start", async (req, reply) => {
    const body = (req.body ?? {}) as { prompt?: string };
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

      // Respond immediately so the client can render the live view
      reply.send({
        runId: crypto.randomUUID(),
        sessionId,
        viewerUrl,
      });

      // Do the actual work in the background; no streaming/logging
      queueMicrotask(async () => {
        try {
          const operator = stagehand.agent();
          await operator.execute({
            instruction,
            maxSteps: 25,
            autoScreenshot: true,
          });
        } catch {
          // swallow errors (no logging requested)
        } finally {
          try { await stagehand.close(); } catch {}
        }
      });
    } catch (e: any) {
      return reply.code(500).send({ error: e?.message || "Failed to start" });
    }
  });

  return app;
}

build().then(app =>
  app.listen({ port: PORT, host: HOST }).then(() => {
    app.log.info(`Stagehand server → http://${HOST}:${PORT}`);
  })
);