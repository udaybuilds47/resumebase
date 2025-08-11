import { Stagehand } from "@browserbasehq/stagehand";
import type { Page } from "playwright";

let attachedPage: Page | null = null;

export function createStagehand(opts?: { attachPage?: Page }) {
  attachedPage = opts?.attachPage ?? null;

  const env = (process.env.SH_ENV ?? "LOCAL") as "LOCAL" | "BROWSERBASE";

  // If we have an attached page, create a minimal Stagehand instance
  // that won't try to launch its own browser
  if (attachedPage) {
    const sh = new Stagehand({
      env,
      modelName: "anthropic/claude-sonnet-4-20250514",
      modelClientOptions: {
        apiKey: process.env.ANTHROPIC_API_KEY!,
      },
      // Don't provide any browser launch options to prevent Stagehand from trying to launch
      // We'll handle the page operations directly
    });

    // Override the page getter to return our attached page
    Object.defineProperty(sh, 'page', {
      get: () => attachedPage,
      configurable: true
    });

    // Override init to do nothing since we already have a page
    const originalInit = sh.init.bind(sh);
    sh.init = async () => {
      // Do nothing - we already have our page
      return {} as any; // Return empty InitResult to satisfy TypeScript
    };

    // Override close to do nothing since we don't own the page
    const originalClose = sh.close.bind(sh);
    sh.close = async () => {
      // Do nothing - we don't own the page
      return;
    };

    return sh;
  }

  // Original behavior for when we need to launch our own browser
  return new Stagehand({
    env,
    modelName: "anthropic/claude-sonnet-4-20250514",
    modelClientOptions: {
      apiKey: process.env.ANTHROPIC_API_KEY!,
    },
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId: process.env.BROWSERBASE_PROJECT_ID,
    browserbaseSessionCreateParams: {
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      browserSettings: {
        blockAds: true,
        viewport: { width: 1280, height: 800 },
      },
    },
    localBrowserLaunchOptions: {
      headless: false,
      viewport: { width: 1280, height: 800 },
    },
  });
}