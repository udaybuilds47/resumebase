'use client';

import { useEffect, useMemo, useState } from "react";

// Type the Electron preload API (exposed in preload.cjs)
declare global {
  interface Window {
    cua?: {
      nav: (url: string) => Promise<void>;   // Electron -> BrowserView navigate
    };
  }
}

type EventMsg = { type: string; [k: string]: any };

export default function Home() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8787";

  const [url, setUrl] = useState("https://duckduckgo.com/");
  const [goal, setGoal] = useState("Search for Babson and open the official site.");
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<EventMsg[]>([]);
  const [starting, setStarting] = useState(false);
  const [currentFrame, setCurrentFrame] = useState<string>("");
  const [electronDetected, setElectronDetected] = useState(false);

  // Check for Electron after component mounts to avoid hydration mismatch
  useEffect(() => {
    setElectronDetected(typeof window !== "undefined" && !!window.cua);
  }, []);

  const status = useMemo(() => {
    const finished = events.find(e => e.type === "session.finished");
    const blocked = events.find(e => e.type === "blocked");
    return blocked ? "Blocked" : finished ? "Finished" : runId ? "Running…" : "Idle";
  }, [events, runId]);

  // NEW: navigate the embedded BrowserView (Electron only)
  const openInEmbedded = async () => {
    const u = url.trim();
    try {
      if (!u) return;
      if (!window.cua?.nav) {
        alert("Electron not detected. Run the desktop app to use the embedded browser.");
        return;
      }
      await window.cua.nav(u.startsWith("http") ? u : `https://${u}`);
    } catch (e: any) {
      alert(`Failed to open: ${e?.message || e}`);
    }
  };

  // Start the episodic run on the server (kept from your version)
  async function start() {
    try {
      setStarting(true);
      setEvents([]);
      setRunId(null);
      const payload = { url, goal, keepOpen: true, live: true };
      const resp = await fetch(`${API_BASE}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await resp.json();
      if (!resp.ok || !json?.ok) throw new Error(json?.error || `HTTP ${resp.status}`);
      setRunId(json.runId);
    } catch (err: any) {
      alert(`Failed to start: ${err?.message || err}`);
    } finally {
      setStarting(false);
    }
  }

  // WS feed (events + optional frames if your API still streams them)
  useEffect(() => {
    if (!runId) return;
    const wsURL = (API_BASE.replace(/^http/, "ws")) + `/ws?runId=${runId}`;
    const ws = new WebSocket(wsURL);

    ws.onmessage = (ev) => {
      const msg: EventMsg = JSON.parse(ev.data);
      if (msg.type === "frame" && (msg.jpeg || msg.png || msg.imageData)) {
        const b64 = msg.jpeg || msg.png || msg.imageData;
        setCurrentFrame(`data:image/jpeg;base64,${b64}`);
      } else {
        setEvents((e) => [msg, ...e].slice(0, 300));
      }
    };

    ws.onerror = () => setEvents(e => [{ type: "ws.error", message: "WebSocket error" }, ...e]);
    return () => ws.close();
  }, [runId, API_BASE]);

  return (
    <div style={{ height: "100vh", display: "grid", gridTemplateRows: "auto 1fr" }}>
      {/* Top bar */}
      <div style={{ padding: 12, borderBottom: "1px solid #eee", display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr auto auto", gap: 8 }}>
          <input
            value={goal}
            onChange={e=>setGoal(e.target.value)}
            placeholder="Goal (e.g. 'Open Babson MBA official page')"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
          />
          <input
            value={url}
            onChange={e=>setUrl(e.target.value)}
            placeholder="Start URL (https://…)"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
          />
          <button
            onClick={openInEmbedded}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ccc", background: "#fafafa" }}
            title={electronDetected ? "Open in embedded browser" : "Electron not detected"}
          >
            Open
          </button>
          <button
            onClick={start}
            disabled={starting}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #222", background: "#111", color: "#fff" }}
          >
            {starting ? "Starting…" : "Start"}
          </button>
        </div>
        <div style={{ alignSelf: "center", fontSize: 12, opacity: 0.8 }}>
          {electronDetected ? "Electron: connected · " : "Electron: not detected · "}
          Status: <b>{status}</b> {runId ? ` · run ${runId.slice(0,8)}` : ""}
        </div>
      </div>

      {/* Two-pane live view */}
      <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 12, padding: 12 }}>
        {/* Left: events */}
        <aside style={{ overflow: "auto", border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Messages</h3>
          {events.length === 0 && <div style={{ opacity: 0.6, fontSize: 13 }}>No events yet.</div>}
          {events.map((e, i) => (
            <div key={i} style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, marginBottom: 8 }}>
              <b>{e.type}</b>{" "}
              {e.url || e.message || e.text || (e.summary ? e.summary.slice(0,180) : "")}
              {typeof e.idx === "number" ? ` (episode ${e.idx+1})` : ""}
            </div>
          ))}
        </aside>

        {/* Right: either the real BrowserView (Electron) OR fallback streamed image */}
        <main style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden", position: "relative", display:"grid", placeItems:"center" }}>
          {electronDetected ? (
            <div style={{ color:"#888", fontSize:13 }}>
              The right pane is the embedded browser window (Electron BrowserView).  
              Use <b>Open</b> to navigate, then <b>Start</b> to let the agent act.
            </div>
          ) : currentFrame ? (
            <img
              src={currentFrame}
              alt="Live stream"
              style={{ width: "100%", height: "100%", objectFit: "contain", imageRendering: "auto" }}
            />
          ) : (
            <div style={{ color:"#888", fontSize:13 }}>
              Start a run to see the live stream here (web fallback).
            </div>
          )}
        </main>
      </div>
    </div>
  );
}