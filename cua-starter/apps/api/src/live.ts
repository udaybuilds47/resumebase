import { WebSocketServer } from "ws";
import type { Server } from "http";
import type { Page } from "playwright";

type Client = import("ws").WebSocket;

const rooms = new Map<string, Set<Client>>();

export function attachWS(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  wss.on("connection", (ws, req) => {
    const url = new URL(req.url!, "http://localhost");
    const runId = url.searchParams.get("runId") || "default";
    if (!rooms.has(runId)) rooms.set(runId, new Set());
    rooms.get(runId)!.add(ws);
    ws.on("close", () => rooms.get(runId)?.delete(ws));
  });
}

export function broadcast(runId: string, payload: any) {
  const msg = JSON.stringify(payload);
  rooms.get(runId)?.forEach((ws) => ws.readyState === ws.OPEN && ws.send(msg));
}

// High-FPS screencast using Chrome DevTools Protocol (Chromium only)
export async function startCDPScreencast(page: Page, runId: string) {
  try {
    console.log("Starting high-quality screenshot streaming...");
    
    // Ensure consistent viewport for quality
    await page.setViewportSize({ width: 1280, height: 800 });
    console.log("Viewport set to 1280x800");
    
    let stopped = false;
    const fps = 10; // Higher FPS for smooth streaming
    const interval = 1000 / fps;
    
    const streamFrames = async () => {
      if (stopped) return;
      
      try {
        // High-quality screenshot with specific options
        const buf = await page.screenshot({
          type: "jpeg",
          quality: 100,        // 👈 maximum JPEG quality
          fullPage: false,
          omitBackground: false,
          timeout: 5000,
          clip: { x: 0, y: 0, width: 1280, height: 800 } // 👈 explicit clip for quality
        });
        
        
        // Broadcast the frame
        broadcast(runId, { type: "frame", imageData: buf.toString("base64") });
        
        // Schedule next frame
        setTimeout(streamFrames, interval);
      } catch (error) {
        console.error("Screenshot error:", error);
        // Continue streaming even if one frame fails
        setTimeout(streamFrames, interval);
      }
    };
    
    // Start streaming
    streamFrames();
    
    // Add useful events
    page.on("framenavigated", f => broadcast(runId, { type: "nav", url: f.url() }));
    page.on("console", m => broadcast(runId, { type: "console", text: m.text() }));
    
    return async () => {
      console.log("Stopping high-quality streaming");
      stopped = true;
    };
  } catch (error) {
    console.error("High-quality streaming failed:", error);
    throw error;
  }
}

// Fallback screencast for non-Chromium browsers
export async function startScreencast(page: Page, runId: string, fps = 4) {
  // Ensure consistent viewport for quality
  await page.setViewportSize({ width: 1280, height: 800 });
  
  let stopped = false;
  const interval = Math.max(1000 / fps, 100); // Higher FPS, lower minimum interval
  
  const tick = async () => {
    if (stopped) return;
    try {
      const buf = await page.screenshot({ 
        type: "png",           // 👈 PNG for lossless quality
        fullPage: false        // 👈 viewport only for performance
      });
      broadcast(runId, { type: "frame", imageData: buf.toString("base64") });
    } catch { /* ignore transient errors while navigating */ }
    setTimeout(tick, interval);
  };
  
  // useful live events
  page.on("framenavigated", f => broadcast(runId, { type: "nav", url: f.url() }));
  page.on("console", m => broadcast(runId, { type: "console", text: m.text() }));
  
  tick();
  return () => { stopped = true; };
}