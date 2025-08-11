// app/page.tsx (or wherever your page lives)
"use client";
import { useMemo, useState } from "react";

type RunStart = { runId: string; sessionId: string; viewerUrl: string | null };

export default function Home() {
  const [prompt, setPrompt] = useState(
    'Go to Google Careers and list 5 software engineer jobs in New York as JSON {title, location, link}.'
  );
  const [loading, setLoading] = useState(false);
  const [run, setRun] = useState<RunStart | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const server = useMemo(
    () => process.env.NEXT_PUBLIC_SERVER_URL || "http://127.0.0.1:8787",
    []
  );

  const start = async () => {
    setLoading(true);
    setErr(null);
    setRun(null);

    try {
      const r = await fetch(`${server}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data: RunStart | { error: string } = await r.json();
      if (!r.ok || (data as any).error) throw new Error((data as any).error || "Start failed");
      setRun(data as RunStart);
    } catch (e: any) {
      setErr(e.message ?? "Failed to start");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: 16, fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
        Director-style Agent (Stagehand × Browserbase) — Live
      </h1>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          style={{ flex: 1, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}
          placeholder="Describe the task…"
        />
        <button
          onClick={start}
          disabled={loading}
          style={{ padding: "12px 16px", borderRadius: 8, border: "1px solid #000", background: "#000", color: "#fff" }}
        >
          {loading ? "Starting…" : "Run"}
        </button>
      </div>

      {err && <p style={{ color: "crimson", marginTop: 12 }}>{err}</p>}

      {run && (
        <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
            <div><b>Session:</b> {run.sessionId ?? "—"}</div>
            {run.viewerUrl && (
              <a href={run.viewerUrl} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>
                Open in new tab ↗
              </a>
            )}
          </div>

          {run.viewerUrl ? (
            <iframe
              key={run.runId} // ensure reload per run
              src={run.viewerUrl}
              style={{
                width: "100%",
                height: "76vh",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                background: "#000",
              }}
              // Browserbase debugger works with these; loosen if needed
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              allow="clipboard-read; clipboard-write; fullscreen"
            />
          ) : (
            <p>No viewer URL returned.</p>
          )}
        </div>
      )}
    </main>
  );
}