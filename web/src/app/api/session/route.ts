import { NextRequest, NextResponse } from "next/server";
import { Browserbase } from "@browserbasehq/sdk";
import { Stagehand } from "@browserbasehq/stagehand";
import crypto from "node:crypto";
import { stagehandLogger } from "@/lib/logger";
import { FileLogger } from "@/lib/fileLogger";

const SYSTEM_PROMPT = [
  "",
  "SCOPE",
  "Observe ONLY the required areas of the form 'application' (the form container under that heading). Exclude job description, footer, and voluntary surveys until submission errors require them.",
  "",
  "FLOW",
  "1) INVENTORY the Apply form: build a checklist {label, role:textbox|textarea|combobox|checkbox|radio|file|button, requiredHint}. Include all visible fields with clear labels (not just required). Scroll the form container to the bottom and back to the top to load lazy content. Expand any accordions/tabs/sections within the application container.",
  "2) FIRST PASS FILL: For every inventoried field that has an obvious mapping from DATA_PROFILE or a safe placeholder, set its value. After typing/selecting, blur the field (press Tab or click away) to trigger validation. Then verify the control reflects the value (read input.value/checked/selected text).",
  "   - combobox: open list; select by visible text via getByRole('option', { name: /…/i }); then verify the combobox displays the chosen option.",
  "   - radio/checkbox: click option by label; then verify checked=true.",
  "   - file: attach the previously uploaded asset named 'resume' to the nearest file input to the 'Resume/CV' label; verify a filename chip appears; do not re-attach if a file is already listed.",
  "3) PRE-SUBMIT VERIFY: Iterate the checklist and ensure no field is empty (for textboxes/textareas: non-empty; for selects/comboboxes: a choice is selected; for radios/checkboxes: the intended option is checked). If a required text field has no DATA_PROFILE mapping, type 'N/A'. Fill any missed items before submitting. If either Resume or LinkedIn is acceptable, ensure at least one is present (prefer attaching resume).",
  "4) SUBMIT the primary 'Submit application'/'Submit'.",
  "5) FIX ERRORS ROBUSTLY:",
  "   - Validation banners may persist until the next submit; DO NOT re-edit a field solely because an error is visible.",
  "   - For each error, find the associated control and inspect its current value/state. If it is already correctly filled, skip it. Only edit controls that are actually empty or mismatched.",
  "   - Error → Control mapping (generic, no hardcoding):",
  "     1) If the error element has an id (e.g., 'question_…-error'), query for any control with [aria-describedby~=errorId].",
  "     2) Else/also, locate the nearest question container (ancestor/sibling) and query within it for visible input, textarea, select, [role='combobox'], or [type='file'].",
  "     3) If a label[for] exists in the same container, resolve the input whose id matches the 'for' value.",
  "     4) If still ambiguous, use proximity: the closest focusable input/select/combobox preceding the error in DOM order.",
  "     5) For custom comboboxes, act on the visible combobox trigger/input, not hidden <select> shadows.",
  "   - After addressing any truly missing items, submit again.",
  "6) DONE on clear success page/banner; then 'close'.",
  "",
  "GREENHOUSE NOTES",
  "- Many selects are custom comboboxes; do not use selectOption on non-<select>.",
  "- Required fields may only surface after submit—expect a fix-and-resubmit loop.",
  "- Avoid redundant 'Attach' clicks; if a filename is present, resume is already attached.",
  "",
  "UNIVERSAL COMBOBOX HANDLING (framework-agnostic)",
  "A) Identify control: prefer visible element with role='combobox' or [aria-haspopup='listbox'] or input[role='combobox'] or a button/input controlling a listbox via aria-controls. If a native <select> is visible, use native selection.",
  "B) Open: click the control; if list does not appear, send Enter/Space/Alt+ArrowDown. Consider portals—listbox may be appended to document.body. Confirm open by aria-expanded='true' or visible listbox.",
  "C) Select option (in order):",
  "   1) Query getByRole('option', { name: /label/i }) in the active listbox (search both within container and globally for portaled lists).",
  "   2) If not found, query common frameworks: [role='option'], li[role='option'], div[role='option'], [data-radix-select-], [data-headlessui-state], [data-value], and match visible text.",
  "   3) If the combobox is typeahead: type the target label into the input and press Enter.",
  "   4) If native <select>: use selectOption/change event.",
  "   5) If the option is offscreen, scroll the listbox and retry a bounded number of times (PageDown/ArrowDown).",
  "D) Verify selection: the combobox displays the chosen label OR aria-activedescendant references an option with aria-selected='true' whose text matches. If not, retry once with a slight delay.",
  "E) Idempotence: if the current displayed value already equals the target, skip reselection. Blur after selection to trigger validation.",
  "F) Do not assume a specific UI library; support MUI, Radix, Headless UI, Downshift, Greenhouse custom widgets, and native selects.",
  "G) Normalize labels for matching: compare case-insensitively; trim whitespace; strip punctuation like apostrophes/dashes; treat synonyms as equivalent (e.g., 'I don't wish to answer' ≈ 'I do not want to answer' ≈ 'Prefer not to say').",
  "",
  "REACT-SELECT STYLE HANDLING (e.g., select__control, remix-css, react-select-*)",
  "- Identify: input.select__input[role='combobox'][id] (e.g., id='disability_status') inside .select__control; placeholder in .select__placeholder; toggle button often labeled 'Toggle flyout'.",
  "- Open: click the input or the 'Toggle flyout' button; wait until a [role='listbox'] becomes visible anywhere in the document (portaled). Also accept aria-expanded='true' on the combobox input.",
  "- Select: prefer getByRole('option', { name: /label/i }); react-select options typically render as div[role='option']. If options not found, type the normalized label into the .select__input and press Enter.",
  "- Verify: after selection, expect .select__single-value or the combobox display to show the chosen label; otherwise aria-activedescendant/aria-selected='true' must match. If mismatch, reopen and reselect once, then try typeahead fallback.",
  "",
  "ACTION REWRITE: StaticText → selectOption (for open listboxes)",
  "Trigger only when a listbox is open: a visible [role='listbox'] exists OR an owning combobox has aria-expanded='true'. Account for portaled lists (search globally).",
  "If the clicked target is within/anchored to that listbox and has role 'StaticText', treat it as an option selection:",
  "  - STRICT: Pick a real option: use the nearest ancestor/sibling with [role='option'] or [aria-selected] to get the label. Or open the listbox and understand the options and then use it. Don't guess.",
  "  - Exclude non-option text: ignore group labels/headers (role='group'/'presentation') and strings like 'Suggested', 'Results', or separators like '—'/'---'.",
  "  - Perform selection using the UNIVERSAL COMBOBOX HANDLING steps (C) and then verify (D). If verification fails, retry once by reopening and reselecting; then fall back to typeahead (type label + Enter).",
  "  - Do not rewrite outside an open listbox.",
  "  - STRICT: Never issue a 'click on StaticText' inside an open listbox. Always select an option by role/label or use typeahead + Enter, then verify the selection."
].join("\n");



export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { prompt?: string; jobUrl?: string; url?: string; resumeUrl?: string };
    const promptFromBody = (body.prompt || "").trim();
    const jobUrl = (body.jobUrl || "").trim();
    const url = (body.url || "").trim();
    const resumeUrl = (body.resumeUrl || "").trim();

    // Provide a small, opinionated data profile so the agent knows defaults for tricky fields.
    const DATA_PROFILE = {
      person: {
        firstName: "John",
        lastName: "Doe",
        preferredFirstName: "Johnny",
        email: "john.doe@example.com",
        phone: "123-456-7890",
        website: "https://example.com",
        github: "https://github.com/johndoe",
        linkedin: "https://www.linkedin.com/in/johndoe",
        locationPreferenceAnswer: "Yes",
        earliestStart: "I am available to start immediately.",
        deadlines: "No deadlines."
      },
      policy: {
        visaSponsorshipNowOrFuture: "No",
        requireVisaSponsorship: "No",
        aiPolicyAcknowledgement: "Yes",
        veteranStatus: "I don't wish to answer",
        gender: "I don't wish to answer",
        hispanicLatino: "I don't wish to answer",
        disabilityStatus: "I don't wish to answer"
      }
    } as const;

    // Build instruction from either prompt or a provided URL
    const instruction =
      promptFromBody ||
      (jobUrl
        ? `Go to ${jobUrl} and fully complete the entire job application end-to-end.

MUST‑DO STEPS:
1) INVENTORY all controls under the 'Apply for this job' form and plan your actions.
2) FILL all required fields using DATA_PROFILE below (comboboxes/radios included). Do not skip any fields in the first pass; verify each control's value after setting it. For any required text field without a clear mapping, enter 'N/A'.
3) If a resume/CV upload is present, attach the provided resume file.
4) Advance through every step/section until final submission.
5) SUBMIT, fix any validation errors, and re-submit until success. When errors appear, check the actual field value; if it is already filled correctly, do not edit it again—simply re-submit after addressing truly empty/mismatched fields.

SUCCESS CRITERIA (do not stop early):
- Only finish after you actually submit and see confirmation (e.g., confirmation page/text, tracking ID, or success banner). If submission fails, handle validation errors and retry.

DATA_PROFILE:
${JSON.stringify(DATA_PROFILE, null, 2)}
`
        : url
        ? `Go to ${url} and fully complete the entire application/task to final submission.

MUST‑DO STEPS:
1) INVENTORY controls and plan your actions.
2) FILL all required fields using DATA_PROFILE below. Do not skip any fields in the first pass; verify each control's value after setting it. For any required text field without a clear mapping, enter 'N/A'.
4) SUBMIT, fix validation errors, and re-submit until success.

SUCCESS CRITERIA (do not stop early):
- Only finish after successful submission is clearly confirmed on the site. Handle validation errors and retry until submitted or steps exhausted.

DATA_PROFILE:
${JSON.stringify(DATA_PROFILE, null, 2)}
`
        : "");

    if (!instruction) {
      return NextResponse.json(
        { error: "Missing prompt. Provide 'prompt' or 'jobUrl' (or 'url')." },
        { status: 400 }
      );
    }

    const modelName =
      process.env.GOOGLE_MODEL || process.env.OPENAI_MODEL || "openai/gpt-4o";
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
      domSettleTimeoutMs: 20000,
      selfHeal: true,
      // Browser viewport configuration
      browserbaseSessionCreateParams: {
        projectId: process.env.BROWSERBASE_PROJECT_ID!,
        browserSettings: {
          viewport: {
            width: parseInt(process.env.BROWSER_WIDTH || "1920"),
            height: parseInt(process.env.BROWSER_HEIGHT || "1080"),
          },
          fingerprint: {
            screen: {
              minWidth: parseInt(process.env.BROWSER_WIDTH || "1920"),
              maxWidth: parseInt(process.env.BROWSER_WIDTH || "1920"),
              minHeight: parseInt(process.env.BROWSER_HEIGHT || "1080"),
              maxHeight: parseInt(process.env.BROWSER_HEIGHT || "1080"),
            },
          },
        },
      },
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
        
        fileLogger.logStagehandReasoning('Agent starting with instruction', { instruction, maxSteps: 90 });
        
        const result = await operator.execute({
          instruction,
          maxSteps: 900,
          autoScreenshot: true,
          waitBetweenActions: 900,
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