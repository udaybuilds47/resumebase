import { NextRequest, NextResponse } from "next/server";
import { Browserbase } from "@browserbasehq/sdk";
import { Stagehand } from "@browserbasehq/stagehand";
import crypto from "node:crypto";

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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { prompt?: string; jobUrl?: string; url?: string; resumeUrl?: string };
    const promptFromBody = (body.prompt || "").trim();
    const jobUrl = (body.jobUrl || "").trim();
    const url = (body.url || "").trim();
    const resumeUrl = (body.resumeUrl || "").trim();

    // Build instruction from either prompt or a provided URL
    const instruction =
      promptFromBody ||
      (jobUrl
        ? `Navigate to ${jobUrl} and complete the entire job application form. Fill all required fields with realistic mock data, upload a resume if needed, and submit.`
        : url
        ? `Navigate to ${url} and complete the task as appropriate.`
        : "");

    if (!instruction) {
      return NextResponse.json(
        { error: "Missing prompt. Provide 'prompt' or 'jobUrl' (or 'url')." },
        { status: 400 }
      );
    }

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
    });

    const { sessionId, sessionUrl, debugUrl } = await stagehand.init();

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

    const response = NextResponse.json({
      runId: crypto.randomUUID(),
      sessionId,
      viewerUrl,
    });

    queueMicrotask(async () => {
      try {
        const operator = stagehand.agent();

        // If a resume URL is provided (e.g., Supabase public URL), fetch to buffer and attempt upload
        let resumeFileSpec: { name: string; mimeType: string; buffer: Buffer } | null = null;
        if (resumeUrl) {
          try {
            const res = await fetch(resumeUrl);
            const ab = await res.arrayBuffer();
            const mimeType = res.headers.get("content-type") || "application/octet-stream";
            const urlName = (() => {
              try { return new URL(resumeUrl).pathname.split("/").pop() || "resume"; } catch { return "resume"; }
            })();
            const name = urlName.includes(".") ? urlName : `${urlName}.pdf`;
            resumeFileSpec = { name, mimeType, buffer: Buffer.from(ab) };
          } catch {}
        }

        const tryUploadResume = async () => {
          if (!resumeFileSpec) return;
          for (let i = 0; i < 5; i += 1) {
            try {
              const r = await stagehand.upload("resume", resumeFileSpec);
              if (r?.success) break;
            } catch {}
            await new Promise((r) => setTimeout(r, 3000));
          }
        };
        // Delay slightly to give the agent time to reach the form before attempting upload
        void (async () => { await new Promise(r => setTimeout(r, 4000)); await tryUploadResume(); })();

        await operator.execute({
          instruction,
          maxSteps: 25,
          autoScreenshot: true,
        });
      } catch {
        // swallow errors (no logging requested)
      } finally {
        try {
          await stagehand.close();
        } catch {}
      }
    });

    return response;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to start" }, { status: 500 });
  }
}

// Single-route GET that mirrors /recording/:sessionId via query param: /api/session?sessionId=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ error: "Missing session ID" }, { status: 400 });
    }

    const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });
    const recording = await bb.sessions.recording.retrieve(sessionId);
    return NextResponse.json({ events: recording });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to retrieve recording" },
      { status: 500 }
    );
  }
}