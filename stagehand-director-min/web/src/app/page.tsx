// app/page.tsx (or wherever your page lives)
"use client";
import { useMemo, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SessionReplay from "@/components/SessionReplay";

type RunStart = { runId: string; sessionId: string; viewerUrl: string | null };

export default function Home() {
  const [prompt, setPrompt] = useState(
    'go to duckduck'
  );
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [run, setRun] = useState<RunStart | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'live' | 'replay'>('live');
  const [recordingReady, setRecordingReady] = useState(false);
  const [liveViewEnded, setLiveViewEnded] = useState(false);
  const [fetchingRecording, setFetchingRecording] = useState(false);

  const server = useMemo(
    () => process.env.NEXT_PUBLIC_SERVER_URL || "http://127.0.0.1:8787",
    []
  );

  // Check if recording is ready
  const checkRecordingReady = useCallback(async () => {
    if (!run?.sessionId || recordingReady) return;
    
    setFetchingRecording(true);
    
    try {
      const response = await fetch(`${server}/recording/${run.sessionId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.events && data.events.length >= 2) {
          setRecordingReady(true);
          setFetchingRecording(false);
          console.log('Recording is ready');
        } else {
          setFetchingRecording(false);
        }
      } else {
        setFetchingRecording(false);
      }
    } catch (err) {
      console.log('Recording not ready yet');
      setFetchingRecording(false);
    }
  }, [run?.sessionId, recordingReady, server]);

  // Auto-switch to replay tab when live view ends
  useEffect(() => {
    if (liveViewEnded && activeTab === 'live') {
      console.log('Live view ended, switching to replay tab');
      setActiveTab('replay');
    }
  }, [liveViewEnded, activeTab]);

  // Check recording readiness periodically
  useEffect(() => {
    if (!run?.sessionId || recordingReady) return;
    
    const interval = setInterval(checkRecordingReady, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
  }, [run?.sessionId, recordingReady, checkRecordingReady]);

  // Monitor WebSocket connection to detect when live view ends
  useEffect(() => {
    if (!run?.viewerUrl) return;
    
    let ws: WebSocket | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 2; // Reduced attempts
    
    const connectWebSocket = () => {
      try {
        // Try multiple WebSocket URL patterns
        const baseUrl = new URL(run.viewerUrl!).origin;
        const possibleUrls = [
          `${baseUrl.replace('http', 'ws').replace('https', 'wss')}/ws/session/${run.sessionId}`,
          `${baseUrl.replace('http', 'ws').replace('https', 'wss')}/session/${run.sessionId}/ws`,
          `${baseUrl.replace('http', 'ws').replace('https', 'wss')}/live/${run.sessionId}`,
          `${baseUrl.replace('http', 'ws').replace('https', 'wss')}/ws`
        ];
        
        let currentUrlIndex = 0;
        
        const tryNextUrl = () => {
          if (currentUrlIndex >= possibleUrls.length) {
            console.log('All WebSocket URLs failed, falling back to iframe monitoring');
            // Don't set live view ended here, let iframe monitoring handle it
            return;
          }
          
          const wsUrl = possibleUrls[currentUrlIndex];
          console.log(`Attempting WebSocket connection to: ${wsUrl} (attempt ${currentUrlIndex + 1}/${possibleUrls.length})`);
          
          try {
            ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
              console.log('WebSocket connected to live view:', wsUrl);
              reconnectAttempts = 0;
            };
            
            ws.onmessage = (event) => {
              // Handle any messages from the live view
              console.log('Live view message:', event.data);
              
              // Check for specific messages that indicate live view ended
              try {
                const data = JSON.parse(event.data);
                if (data.type === 'session_ended' || data.status === 'completed') {
                  console.log('Live view ended via message');
                  setLiveViewEnded(true);
                  checkRecordingReady();
                }
              } catch (e) {
                // Not JSON, continue monitoring
              }
            };
            
            ws.onclose = (event) => {
              console.log('WebSocket closed:', event.code, event.reason);
              
              // Check if it's a normal closure or error
              if (event.code === 1000 || event.code === 1001) {
                // Normal closure - live view ended
                console.log('Live view ended - WebSocket closed normally');
                setLiveViewEnded(true);
                checkRecordingReady();
              } else if (reconnectAttempts < maxReconnectAttempts) {
                // Try to reconnect to the same URL
                reconnectAttempts++;
                console.log(`WebSocket reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
                setTimeout(() => tryNextUrl(), 1000 * reconnectAttempts);
              } else {
                // Try next URL
                reconnectAttempts = 0;
                currentUrlIndex++;
                setTimeout(tryNextUrl, 1000);
              }
            };
            
            ws.onerror = (error) => {
              console.log('WebSocket error for URL:', wsUrl, error);
              // Don't log as error to avoid console spam
            };
            
          } catch (error) {
            console.log('Failed to create WebSocket for URL:', wsUrl);
            currentUrlIndex++;
            setTimeout(tryNextUrl, 1000);
          }
        };
        
        // Start with first URL
        tryNextUrl();
        
      } catch (error) {
        console.log('Failed to parse viewer URL, falling back to iframe monitoring');
      }
    };
    
    // Start WebSocket connection
    connectWebSocket();
    
    // Cleanup function
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [run?.viewerUrl]);

  // Alternative: Monitor iframe connection status as backup
  useEffect(() => {
    if (!run?.viewerUrl || activeTab !== 'live') return;
    
    // Check if iframe is still responsive
    const checkIframeConnection = () => {
      const iframe = document.querySelector('iframe[src*="' + run.viewerUrl + '"]') as HTMLIFrameElement;
      if (iframe) {
        try {
          // Try to access iframe content (this will fail if connection is lost)
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!iframeDoc) {
            console.log('Iframe connection lost - live view ended');
            setLiveViewEnded(true);
            checkRecordingReady();
            return;
          }
          
          // Check if iframe has content
          if (iframe.contentWindow?.location.href) {
            // Iframe is responsive
            return;
          }
        } catch (error) {
          // Cross-origin error or connection lost
          console.log('Iframe connection error - live view ended');
          setLiveViewEnded(true);
          checkRecordingReady();
          return;
        }
      }
    };
    
    // Check connection every 2 seconds
    const interval = setInterval(checkIframeConnection, 2000);
    
    return () => clearInterval(interval);
  }, [run?.viewerUrl, activeTab]);

  // Final fallback: Timer-based detection if both WebSocket and iframe monitoring fail
  useEffect(() => {
    if (!run?.viewerUrl || activeTab !== 'live') return;
    
    // If after 2 minutes we still haven't detected live view ending, assume it ended
    // This is a safety net for cases where monitoring fails
    const fallbackTimer = setTimeout(() => {
      if (!liveViewEnded) {
        console.log('Fallback timer: assuming live view ended after 2 minutes');
        setLiveViewEnded(true);
        checkRecordingReady();
      }
    }, 120000); // 2 minutes
    
    return () => clearTimeout(fallbackTimer);
  }, [run?.viewerUrl, activeTab, liveViewEnded]);

  const start = async () => {
    setLoading(true);
    setErr(null);
    setRun(null);
    setRecordingReady(false);
    setLiveViewEnded(false);
    setActiveTab('live');
    setFetchingRecording(false);

    try {
      // Build an instruction that hints the agent to use the upload tool
      const safeName = uploadFile ? (uploadFile.name.replace(/[^A-Za-z0-9._-]/g, '_') || 'upload.bin') : '';
      const composedPrompt = uploadFile
        ? `${prompt}\nA file named '${safeName}' has been provided. Use setInputFiles to attach it to the file input.`
        : prompt;

      // Step 1: create a session (does not start agent)
      const r = await fetch(`${server}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: composedPrompt }),
      });
      const data: RunStart | { error: string } = await r.json();
      if (!r.ok || (data as any).error) throw new Error((data as any).error || "Start failed");
      setRun(data as RunStart);

      // Step 2: if a file was selected, upload it and await completion
      let remotePathFromUpload: string | null = null;
      if (uploadFile && (data as any).sessionId) {
        const uploadRes = await fetch(`${server}/uploads/${(data as any).sessionId}?filename=${encodeURIComponent(safeName)}` , {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: uploadFile,
        });
        try {
          const uploadJson = await uploadRes.json();
          if (uploadRes.ok && uploadJson?.remotePath) {
            remotePathFromUpload = uploadJson.remotePath as string;
          }
        } catch {}
      }

      // Step 3: start the agent for this session
      if ((data as any).sessionId) {
        const finalPrompt = `${prompt}\nA file named '${safeName}' has been provided. Use the 'upload_and_attach_file' tool to attach it to the correct file input (do not open OS dialogs).`;
        await fetch(`${server}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: (data as any).sessionId, prompt: finalPrompt }),
        });
      }
    } catch (e: any) {
      setErr(e.message ?? "Failed to start");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={`min-h-screen max-w-6xl mx-auto p-3 flex flex-col ${!run ? 'justify-center items-center' : ''}`}>
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
              className="whitespace-nowrap font-sans font-normal"
            >
              {loading ? "Starting…" : "Run"}
            </Button>
          </div>

          {/* Optional file to make available to the agent */}
          <div className="mb-2">
            <input
              type="file"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              className="font-sans border rounded px-3 py-2"
            />
          </div>

          {err && (
            <p className="font-sans text-sm mb-2 text-destructive">
              {err}
            </p>
          )}
        </CardContent>
      </Card>

      {run && (
        <Card className="flex-1 flex flex-col animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
          <CardHeader className="pb-3 flex-shrink-0">
            <CardTitle className="text-xl"> Session</CardTitle>
            {/* Tab Navigation */}
            <div className="flex gap-2 mt-3">
              <Button
                variant={activeTab === 'live' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('live')}
                disabled={!run.viewerUrl || liveViewEnded}
                className="font-normal"
              >
                Live View
              </Button>
              <Button
                variant={activeTab === 'replay' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('replay')}
                disabled={!run.sessionId || (!recordingReady && !fetchingRecording)}
                className="font-normal"
              >
                Session Replay
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 flex-1 flex flex-col min-h-0">
            {activeTab === 'live' && run.viewerUrl ? (
              <iframe
                key={run.runId} // ensure reload per run
                src={run.viewerUrl}
                className="w-full flex-1 border border-gray-200 rounded-lg bg-black min-h-0"
                // Browserbase debugger works with these; loosen if needed
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                allow="clipboard-read; clipboard-write; fullscreen"
              />
            ) : activeTab === 'replay' && run.sessionId ? (
              <SessionReplay 
                sessionId={run.sessionId} 
                serverUrl={server} 
                isFetching={fetchingRecording}
              />
            ) : (
              <p className="font-sans">No content available for selected tab.</p>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}