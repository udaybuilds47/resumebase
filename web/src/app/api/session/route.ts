import { NextRequest, NextResponse } from "next/server";
import { Browserbase } from "@browserbasehq/sdk";
import { Stagehand } from "@browserbasehq/stagehand";
import crypto from "node:crypto";
import { stagehandLogger } from "@/lib/logger";
import { FileLogger } from "@/lib/fileLogger";

const SYSTEM_PROMPT = [
  "Go to the open web to accomplish the user's goal.",
  "If required info is missing, ask before proceeding.",
  "Never attempt to bypass login, paywalls, CAPTCHA, or MFA.",
  "Prefer robust actions by visible text/role over brittle CSS selectors.",
  "When the task implies a list, return strictly JSON (no prose).",
  "",
  "**HUMAN-LIKE APPLICATION APPROACH:**",
  "- Think like a human applying for a job - read the ENTIRE page before making any decisions",
  "- Scan the complete page layout to understand the form structure and flow",
  "- Identify the main application form vs. duplicate/auxiliary forms or buttons",
  "- Look for the primary 'Submit Application' or 'Submit' button, not just any 'Apply' button",
  "",
  "**FORM FILLING INSTRUCTIONS:**",
  "- Look for form fields with labels like 'First Name', 'Last Name', 'Email', 'Phone', 'Address', 'City', 'State', 'Zip Code'",
  "- Fill each field with realistic mock data (use common names, valid email formats, realistic phone numbers)",
  "- Look for file upload fields labeled 'Resume', 'CV', 'Cover Letter', 'Document' and upload the provided file",
  "- Fill all required fields marked with asterisks (*), 'required' text, or red borders",
  "- For dropdown/select fields, choose the first available option unless a specific choice is obvious",
  "- For radio buttons and checkboxes, select appropriate options based on context",
  "- Fill address fields completely: street address, city, state, zip code",
  "- Use realistic dates for birth dates, graduation dates, etc.",
  "- Submit the form only when all required fields are completed",
  "",
  "**NAVIGATION GUIDANCE:**",
  "- Read the page content carefully to understand what information is needed",
  "- Look for 'Next', 'Continue', 'Submit', or similar buttons to proceed",
  "- If there are multiple steps, complete each step before moving to the next",
  "- Pay attention to error messages and validation feedback",
  "- If you see multiple 'Apply' buttons, identify the main application form and ignore duplicate buttons",
  "- Look for the primary 'Submit Application' button, not secondary 'Apply' or 'Save' buttons",
  "",
  "**LOGICAL DECISION MAKING:**",
  "- If there are multiple forms on the page, identify which one is the main job application",
  "- Fill fields only in the main application form, not in duplicate or auxiliary forms",
  "- Look for visual cues like larger forms, prominent positioning, or 'Submit Application' text",
  "- If unsure about which form to use, look for the form that has the most comprehensive job application fields",
  "",
  "Once you've completed the main application form and submitted it successfully, issue a 'close' step and stop.",
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
        ? `Go to ${jobUrl} and fully complete the entire job application end‑to‑end.

MUST‑DO STEPS:
1) Read the whole page to understand the layout and identify the main application form.
2) Fill ALL required fields with realistic mock data (name, email, phone, address, dates, etc.).
3) If a resume/CV upload is present, attach the provided resume file. If not provided, proceed without it.
4) Advance through every step/section until you reach the final submission.
5) Submit the application using the primary “Submit Application”/“Submit” button (not a secondary Apply).

SUCCESS CRITERIA (do not stop early):
- Only finish after you actually submit and see confirmation (e.g., confirmation page/text, tracking ID, or success banner). If submission fails, handle validation errors and retry.
`
        : url
        ? `Go to ${url} and fully complete the entire application/task to final submission.

MUST‑DO STEPS:
1) Read the page, identify the main form.
2) Fill ALL required fields with realistic mock data.
3) Upload the provided resume file if applicable.
4) Advance through every step/section and submit.

SUCCESS CRITERIA (do not stop early):
- Only finish after successful submission is clearly confirmed on the site. Handle validation errors and retry until submitted or steps exhausted.`
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
      verbose: 2, // Enable maximum verbose logging (0=error, 1=info, 2=debug)
      logInferenceToFile: true, // Save detailed reasoning to log files
      experimental: true, // enable iframe-aware observation & deep selectors
      domSettleTimeoutMs: 15000,
      selfHeal: true,
    });

    const { sessionId, sessionUrl, debugUrl } = await stagehand.init();
    
    // Initialize file logger for this session
    const fileLogger = new FileLogger(sessionId || 'unknown');
    fileLogger.log('info', '🚀 Session initialized', { sessionId, sessionUrl, debugUrl });

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

    const runId = crypto.randomUUID();
    
    const response = NextResponse.json({
      runId,
      sessionId,
      viewerUrl,
    });
    
    fileLogger.log('info', '📤 Response sent to client', { runId, sessionId, viewerUrl });

    queueMicrotask(async () => {
      try {
        const operator = stagehand.agent();

        // If a resume URL is provided, pass it to Stagehand for natural form filling
        let resumeUrlForStagehand = resumeUrl;
        
        if (resumeUrl) {
          fileLogger.log('info', '📎 Resume URL provided', { resumeUrl });
        } else {
          fileLogger.log('info', '⚠️ No resume URL provided - will use mock data only');
        }

        // Proactively upload the resume file into the Stagehand session so the agent can attach it
        const tryUploadResume = async () => {
          if (!resumeUrl) return;
          try {
            const res = await fetch(resumeUrl);
            const ab = await res.arrayBuffer();
            const mimeType = res.headers.get('content-type') || 'application/pdf';
            const urlName = (() => {
              try { return new URL(resumeUrl).pathname.split('/')?.pop() || 'resume.pdf'; } catch { return 'resume.pdf'; }
            })();
            const name = urlName.includes('.') ? urlName : 'resume.pdf';
            const fileSpec = { name, mimeType, buffer: Buffer.from(ab) } as const;

            for (let i = 0; i < 5; i += 1) {
              try {
                const r = await stagehand.upload('resume', fileSpec);
                if (r?.success) {
                  fileLogger.log('info', '📎 Resume uploaded to session', { name: fileSpec.name });
                  return;
                }
              } catch {}
              await new Promise((r) => setTimeout(r, 1500));
            }
            fileLogger.log('error', '❌ Resume upload did not report success after retries');
          } catch (e: any) {
            fileLogger.log('error', '❌ Failed to fetch/upload resume', { error: e?.message || String(e) });
          }
        };

        // Small delay to let the agent navigate before attempting upload (helps some UIs detect the file input)
        void (async () => { await new Promise(r => setTimeout(r, 3000)); await tryUploadResume(); })();

        // Custom logging to capture Stagehand's reasoning
        stagehandLogger.log('info', '🚀 Starting Stagehand agent', { instruction });
        fileLogger.log('info', '🤖 Starting Stagehand agent execution', { instruction });
        console.log("🚀 Starting Stagehand agent with instruction:", instruction);
        
        fileLogger.logStagehandReasoning('Agent starting with instruction', { instruction, maxSteps: 75 });
        
        const result = await operator.execute({
          instruction,
          maxSteps: 75, // Increased for complex form completion
          autoScreenshot: true,
          waitBetweenActions: 400,
        });
        
        fileLogger.logStagehandReasoning('Agent execution completed', { 
          success: result.success, 
          result: result 
        });
        
        stagehandLogger.log('info', '✅ Stagehand execution completed', { 
          success: result.success, 
          result: result 
        });
        
        console.log("✅ Stagehand execution completed:", {
          success: result.success,
          result: result
        });
      } catch {
        // swallow errors (no logging requested)
      } finally {
        try {
          fileLogger.log('info', '🔚 Closing Stagehand session');
          await stagehand.close();
          fileLogger.log('info', '✅ Session closed successfully');
        } catch (error) {
          fileLogger.log('error', '❌ Error closing session', { error: error instanceof Error ? error.message : String(error) });
        }
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