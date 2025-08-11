// apps/api/src/index.ts
import http from "http";
import express from "express";
import cors from "cors";
import "dotenv/config";

import { randomUUID } from "crypto";
import { createStagehand } from "../../../packages/agent/src/stagehandClient";
import { attachWS, broadcast, startScreencast } from "./live";  // 👈 Import startScreencast
import { planEpisodes } from "./planner";
import { launchAgentBrowser, getWebviewPage } from "./cdp";  // 👈 Import both functions

const app = express();
app.use(express.json());
app.use(cors({ origin: "http://localhost:3000" }));

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

app.post("/run", async (req, res) => {
  const {
    url,
    goal,
    task,
    episodes,
    maxSteps = 8,
    model = "claude-3-7-sonnet-latest",
    keepOpen = false,
    live = true,
    allowlist = [] as string[],
    backgroundMode = false,  // 👈 New flag for background agent mode
    useExistingWebview = false,  // 👈 New flag to use existing webview
  } = req.body ?? {};

  const runId = randomUUID();
  broadcast(runId, { type: "session.created", runId });

  // kick off the run in the background
  (async () => {
    let browser: any, context: any, page: any;
    
    // 👈 Always use separate browser for reliability
    // The screencast will make it appear as if the agent is running in the webview
    console.log('Launching separate browser instance for agent...');
    const result = await launchAgentBrowser();
    browser = result.browser;
    context = result.context;
    page = result.page;
    console.log('Launched separate browser instance for agent');
    
    // 👈 No need to check URL since this is a completely separate browser
    
    if (url) { 
      await page.goto(url, { waitUntil: "domcontentloaded" }); 
      broadcast(runId, { type: "nav", url }); 
    }
    
    // 👈 Viewport constraints are already applied in launchAgentBrowser
    // No need for additional checks or constraints here
    
    // Create Stagehand with attached page
    const sh = createStagehand({ attachPage: page });
    await sh.init(); // This will do nothing when we have an attached page
    
    // 👈 Always start screencast to show agent actions in the webview area
    console.log("Starting screencast - agent actions will be visible in webview");
    startScreencast(page, runId);
    
    // 👈 Add navigation and console event listeners for real-time updates
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) {
        broadcast(runId, { 
          type: "agent.navigation", 
          url: frame.url(),
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Show console messages from the agent's actions
    page.on("console", (msg) => {
      broadcast(runId, { 
        type: "agent.console", 
        level: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      });
    });

    try {
      broadcast(runId, { type: "session.started", env: "LOCAL", runId });

      // decide episodes (planner if goal provided)
      type Ep = { task: string; maxSteps?: number };
      let planned: Ep[] | undefined;
      let effectiveAllowlist = allowlist.slice();

      if ((!episodes || episodes.length === 0) && goal) {
        const html = await sh.page.content();
        const plan = await planEpisodes({
          url: url ?? "",
          userGoal: String(goal),
          htmlSnippet: html,
          maxEpisodes: 3,
        });
        const plannerAllow = Array.isArray(plan?.allowlist) ? plan.allowlist : [];
        effectiveAllowlist = Array.from(new Set([...effectiveAllowlist, ...plannerAllow]));
        planned = (plan?.episodes || []).map((e: any) => ({
          task: String(e.task || ""),
          maxSteps: Math.max(4, Math.min(8, Number(e.maxSteps || maxSteps))),
        }));
        broadcast(runId, { type: "planned", allowlist: effectiveAllowlist, episodes: planned });
      }

      const epList: Ep[] =
        planned?.length
          ? planned
          : (Array.isArray(episodes) && episodes.length
              ? episodes.map((e: any) => ({ task: String(e.task || ""), maxSteps: Number(e.maxSteps ?? maxSteps) }))
              : [{ task: String(task ?? goal ?? ""), maxSteps: Number(maxSteps) }]);

      const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms));
      const allActions: any[] = [];
      const summaries: string[] = [];

      async function runEpisode(ep: Ep, idx: number) {
        const baseLines = [
          "You control a web browser. Respond ONLY with tool actions (click/type/key/scroll/screenshot/wait).",
          "Prefer keys over clicks (use Enter to submit).",
          "If you see captcha, login wall, or paywall, STOP immediately and output 'BLOCKED:<reason>'.",
        ];
        if (effectiveAllowlist.length) {
          baseLines.push(`Only interact within these domains: ${effectiveAllowlist.join(", ")}`);
        }

        const agent = sh.agent({
          provider: "anthropic",
          model,
          instructions: baseLines.join("\n"),
          options: {
            apiKey: process.env.ANTHROPIC_API_KEY!,
            headers: { "anthropic-beta": process.env.ANTHROPIC_BETA! },
          },
        });

        broadcast(runId, { type: "episode.start", idx, maxSteps: ep.maxSteps ?? 8, task: ep.task });

        const execOnce = () =>
          agent.execute({ instruction: ep.task, maxSteps: ep.maxSteps ?? 8 }); // ← plural

        let result: any;
        try {
          try {
            result = await execOnce();
          } catch (e: any) {
            if ((e?.status ?? e?.response?.status) === 429) {
              const ra = Number(e?.headers?.["retry-after"] ?? e?.response?.headers?.["retry-after"] ?? 60);
              broadcast(runId, { type: "rate_limit", episode: idx, retryAfter: ra });
              await sleep(ra * 1000);
              result = await execOnce();
            } else { throw e; }
          }
        } catch (err:any) {
          broadcast(runId, { type: "episode.error", idx, message: String(err?.message || err) });
          throw err;
        }

        const summary = String(result?.message ?? "");
        const actions = Array.isArray(result?.actions) ? result.actions : [];
        actions.forEach(a => (a.episode = idx));
        allActions.push(...actions);
        summaries.push(summary);

        // 👈 Always broadcast actions for real-time updates in sidebar
        actions.forEach((action, actionIdx) => {
          const actionEvent = {
            type: "agent.action",
            episode: idx,
            actionIndex: actionIdx,
            action: action.type || "unknown",
            details: action.description || action.text || "Action performed",
            timestamp: new Date().toISOString()
          };
          broadcast(runId, actionEvent);
        });

        broadcast(runId, { type: "episode.finish", idx, summary, actionsCount: actions.length });
        return /^BLOCKED:/i.test(summary);
      }

      // 👈 Execute all episodes
      for (let i = 0; i < epList.length; i++) {
        const blocked = await runEpisode(epList[i], i);
        await sleep(350);
        if (blocked) break;
      }

      broadcast(runId, { type: "session.finished", ok: true });

      if (!keepOpen) { 
        try { 
          await sh.close(); 
          // 👈 Always close browser/context since we always create them
          await context.close();
          await browser.close();
        } catch {} 
      }

      // Optional: persist summaries/actions somewhere here

    } catch (outerErr) {
      broadcast(runId, { type: "error", message: String((outerErr as any)?.message || outerErr) });
      try { 
        await sh.close(); 
        // 👈 Always close browser/context since we always create them
        await context.close();
        await browser.close();
      } catch {}
    }
  })();

  // respond immediately so the UI can redirect/open live view
  res.json({ ok: true, runId });
});

// boot HTTP + WS
const server = http.createServer(app);
attachWS(server);
server.listen(8787, () => console.log("API on :8787 with WS at /ws"));