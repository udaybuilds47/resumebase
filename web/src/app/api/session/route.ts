import { NextRequest, NextResponse } from "next/server";
import { Browserbase } from "@browserbasehq/sdk";
import { Stagehand } from "@browserbasehq/stagehand";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const browserbase = new Browserbase({
  apiKey: process.env.BROWSERBASE_API_KEY || "",
});

export async function POST(request: NextRequest) {
  try {
    const { action, url, sessionId } = await request.json();

    if (!action) {
      return NextResponse.json({ error: "Action is required (start or stop)" }, { status: 400 });
    }
    if (!process.env.BROWSERBASE_API_KEY) {
      return NextResponse.json(
        { error: "Browserbase API key not configured" },
        { status: 500 }
      );
    }
    if (!process.env.BROWSERBASE_PROJECT_ID) {
      return NextResponse.json(
        { error: "Browserbase Project ID not configured" },
        { status: 500 }
      );
    }
    if (!process.env.GOOGLE_API_KEY || !process.env.GOOGLE_MODEL) {
      return NextResponse.json(
        { error: "Google Gemini API key or model not configured" },
        { status: 500 }
      );
    }

    const projectId = process.env.BROWSERBASE_PROJECT_ID;

    if (action === "start") {
        if (!url) {
          return NextResponse.json(
            { error: "URL is required for starting session" },
            { status: 400 }
          );
        }
      
        // 1. Start a Browserbase session
        const session = await browserbase.sessions.create({ projectId });
      
        // 2. Kick off Stagehand navigation asynchronously
        (async () => {
          try {
            const stagehand = new Stagehand({
              env: "BROWSERBASE",
              apiKey: process.env.BROWSERBASE_API_KEY!,
              projectId,
              browserbaseSessionID: session.id,  // ✅ typo fixed (ID not ID)
              modelName: process.env.GOOGLE_MODEL!,
              modelClientOptions: {
                apiKey: process.env.GOOGLE_API_KEY!,
              },
            });
      
            await stagehand.init();
            await stagehand.page.goto(url);
            // Don’t close stagehand here – let the session stay live
          } catch (err) {
            console.error("Background navigation failed:", err);
          }
        })();
      
        // 3. Return immediately with viewerUrl so frontend iframe loads right away
        let viewerUrl: string | null = null;
        try {
          const dbg = await browserbase.sessions.debug(session.id);
          viewerUrl = dbg?.debuggerFullscreenUrl ?? dbg?.debuggerUrl ?? null;
        } catch {
          viewerUrl = session.connectUrl
            ? session.connectUrl.replace("wss://", "https://").replace("ws://", "http://")
            : null;
        }
      
        return NextResponse.json({
          success: true,
          session: {
            sessionId: session.id,
            url,
            status: "active",
            timestamp: new Date().toISOString(),
            browserbaseData: session,
            sessionUrl: session.connectUrl || session.seleniumRemoteUrl || null,
            viewerUrl,
          },
          message: "Browserbase session started — navigating in background",
        });
      }

    if (action === "stop") {
      if (!sessionId) {
        return NextResponse.json(
          { error: "Session ID is required for stopping session" },
          { status: 400 }
        );
      }

      await browserbase.sessions.update(sessionId, {
        projectId,
        status: "REQUEST_RELEASE",
      });

      return NextResponse.json({
        success: true,
        message: "Session stopped successfully",
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "start" or "stop"' },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error in session operation:", error);
    return NextResponse.json(
      {
        error: "Failed to perform session operation",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}