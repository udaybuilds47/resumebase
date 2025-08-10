import { Stagehand } from "@browserbasehq/stagehand";

export function createStagehand() {
  const env = (process.env.SH_ENV ?? "LOCAL") as "LOCAL" | "BROWSERBASE";

  return new Stagehand({
    env,
    // LLM: Anthropic Claude Sonnet 4
    // Stagehand accepts "provider/model" format.
    // You can also use "anthropic/claude-3-7-sonnet-latest".
    modelName: "anthropic/claude-sonnet-4-20250514",
    modelClientOptions: {
      apiKey: process.env.ANTHROPIC_API_KEY!,
    },

    // Remote (Browserbase) setup
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId: process.env.BROWSERBASE_PROJECT_ID,
    browserbaseSessionCreateParams: {
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      browserSettings: {
        blockAds: true,
        // CUA returns XY clicks – pin your viewport
        viewport: { width: 1280, height: 800 },
      },
    },

    // Local Playwright fallback
    localBrowserLaunchOptions: {
      headless: false,                  // 👈 switch to true
      viewport: { width: 1280, height: 800 }, // 👈 standard viewport for AI agent
    },
  });
}