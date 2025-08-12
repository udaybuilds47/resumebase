// app/page.tsx (or wherever your page lives)
"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <main className={`h-screen max-w-6xl mx-auto p-3 flex flex-col overflow-hidden ${!run ? 'justify-center items-center' : ''}`}>
      <Card className={`transition-all duration-500 ease-in-out ${!run ? 'w-full max-w-2xl' : 'flex-shrink-0 mb-2'}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-3xl font-normal font-serif">
            resumebase
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-2 mb-2">
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the task…"
              className="flex-1 font-sans"
            />
            <Button
              onClick={start}
              disabled={loading}
              className="whitespace-nowrap font-sans"
            >
              {loading ? "Starting…" : "Run"}
            </Button>
          </div>

          {err && (
            <p className="font-sans text-sm mb-2 text-destructive">
              {err}
            </p>
          )}
        </CardContent>
      </Card>

      {run && (
        <Card className="flex-1 flex flex-col overflow-hidden animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
          <CardHeader className="pb-3 flex-shrink-0">
            <div className="flex gap-3 items-center flex-wrap text-sm">
              <div className="font-serif"><b>Session:</b> <span className="font-sans">{run.sessionId ?? "—"}</span></div>
              {run.viewerUrl && (
                <a 
                  href={run.viewerUrl} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-blue-600 hover:underline font-sans"
                >
                  Open in new tab ↗
                </a>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 flex-1 flex flex-col overflow-hidden">
            {run.viewerUrl ? (
              <iframe
                key={run.runId} // ensure reload per run
                src={run.viewerUrl}
                className="w-full flex-1 border border-gray-200 rounded-lg bg-black min-h-0"
                // Browserbase debugger works with these; loosen if needed
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                allow="clipboard-read; clipboard-write; fullscreen"
              />
            ) : (
              <p className="font-sans">No viewer URL returned.</p>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}