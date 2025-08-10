import { z } from "zod";
import { createStagehand } from "./stagehandClient";

export async function runComputerUse({ url, task, maxSteps = 12 }: {
  url?: string; task: string; maxSteps?: number;
}) {
  const sh = createStagehand();
  await sh.init();
  await sh.page.setViewportSize({ width: 1920, height: 1080 }); // or 1600x900


  if (url) await sh.page.goto(url);

  // Stagehand's agent() supports "anthropic" with Claude CUA models
  const agent = sh.agent({
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",   // or "claude-3-7-sonnet-latest"
    instructions: [
      "You control a web browser. Be decisive; avoid asking confirmations.",
      "If blocked (auth/paywall/cookie), explain the blocker briefly."
    ].join(" "),
    options: {
      apiKey: process.env.ANTHROPIC_API_KEY!,
      headers: { "anthropic-beta": process.env.ANTHROPIC_BETA ?? "computer-use-2025-01-24" }
    }
  });

  const result = await agent.execute({ instruction: task, maxSteps });
  const sessionId = (sh as any).browserbaseSessionID; // defined when env=BROWSERBASE

  await sh.close();
  return { result, sessionId };
}