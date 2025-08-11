'use client';

import { useEffect, useMemo, useState, useRef } from "react";

// Type the Electron preload API (exposed in preload.cjs)
declare global {
  interface Window {
    cua?: {
      // Modern approach: WebContentsView will be embedded in the renderer
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
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const [showFrames, setShowFrames] = useState(false);
  const [starting, setStarting] = useState(false); // 👈 Restore starting state
  const [electronDetected, setElectronDetected] = useState(false);
  const [webviewCreated, setWebviewCreated] = useState(false); // 👈 Track if webview has been created
  const [backgroundMode, setBackgroundMode] = useState(false); // 👈 Track if agent is running in background mode
  const webviewRef = useRef<any>(null); // 👈 Use any type to avoid type issues
  const [activeTab, setActiveTab] = useState<'events' | 'console' | 'settings'>('events');

  // Check for Electron after component mounts to avoid hydration mismatch
  useEffect(() => {
    setElectronDetected(typeof window !== "undefined" && !!window.cua);
    
    // Debug: Check if webview is available
    if (typeof window !== "undefined") {
      console.log('Webview available:', typeof (window as any).HTMLWebViewElement !== 'undefined');
      console.log('Window cua object:', window.cua);
    }
  }, []);

  const status = useMemo(() => {
    const finished = events.find(e => e.type === "session.finished");
    const blocked = events.find(e => e.type === "blocked");
    return blocked ? "Blocked" : finished ? "Finished" : runId ? "Running…" : "Idle";
  }, [events, runId]);

  const reset = () => {
    setRunId(null);
    setEvents([]);
    setCurrentFrame(null);
    setWebviewCreated(false);
    setBackgroundMode(false);
  };

  // Modern approach: WebContentsView will be embedded in the renderer
  const openInEmbedded = async () => {
    const u = url.trim();
    try {
      if (!u) return;
      
      // Use the ref to get the webview element (more reliable)
      const webview = webviewRef.current;
      console.log('Found webview:', webview);
      
      if (webview) {
        const fullUrl = u.startsWith("http") ? u : `https://${u}`;
        console.log('Navigating to:', fullUrl);
        
        // Force reload by clearing and setting src, or use loadURL for better control
        if (webview.loadURL) {
          // Use loadURL method if available (more reliable)
          webview.loadURL(fullUrl);
        } else {
          // Fallback to setting src with a small delay to ensure proper reload
          webview.src = '';
          setTimeout(() => {
            webview.src = fullUrl;
          }, 50);
        }
        
        // Reset any previous state
        setCurrentFrame("");
        setEvents([]);
        setRunId(null);
      } else {
        console.log('No webview found');
        alert('Webview not found. Make sure Electron is running.');
      }
    } catch (e: any) {
      console.error('Error:', e);
      alert(`Failed to open: ${e?.message || e}`);
    }
  };

  // Start the episodic run on the server (kept from your version)
  const start = async () => {
    if (!url || !goal) return;
    
    setStarting(true);
    setEvents([]);
    setCurrentFrame(null);
    
    // 👈 Create the webview when starting the agent
    setWebviewCreated(true);
    setBackgroundMode(false); // 👈 Agent will run in webview, not background
    
    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          url, 
          goal, 
          keepOpen: true, 
          live: true,
          backgroundMode: false,  // 👈 Run agent in webview, not background
          useExistingWebview: false  // 👈 Create new webview for agent
        }),
      });
      
      if (response.ok) {
        const { runId: newRunId } = await response.json();
        setRunId(newRunId);
      } else {
        console.error("Failed to start agent");
      }
    } catch (error) {
      console.error("Error starting agent:", error);
    } finally {
      setStarting(false);
    }
  };

  // WS feed (events + optional frames if your API still streams them)
  useEffect(() => {
    if (!runId) return;
    const wsURL = (API_BASE.replace(/^http/, "ws")) + `/ws?runId=${runId}`;
    const ws = new WebSocket(wsURL);

    ws.onmessage = (ev) => {
      const msg: EventMsg = JSON.parse(ev.data);
      
      if (msg.type === "frame" && (msg.jpeg || msg.png || msg.imageData)) {
        // 👈 Show frames in webview mode (when backgroundMode is false)
        if (!backgroundMode) {
          const b64 = msg.jpeg || msg.png || msg.imageData;
          setCurrentFrame(`data:image/jpeg;base64,${b64}`);
        }
      } else {
        setEvents((e) => [msg, ...e].slice(0, 300));
      }
    };

    ws.onerror = () => setEvents(e => [{ type: "ws.error", message: "WebSocket error" }, ...e]);
    return () => ws.close();
  }, [runId, API_BASE]);

  return (
    <div style={{ height: "100vh", display: "grid", gridTemplateRows: "auto 1fr", background: "#f8fafc" }}>
      {/* Top bar */}
      <div style={{ 
        padding: "16px 20px", 
        borderBottom: "1px solid #e2e8f0", 
        background: "white",
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr auto auto", gap: 12, alignItems: "center" }}>
          <input
            value={goal}
            onChange={e=>setGoal(e.target.value)}
            placeholder="Goal (e.g. 'Open Babson MBA official page')"
            style={{ 
              padding: "12px 16px", 
              borderRadius: 8, 
              border: "1px solid #d1d5db",
              fontSize: "14px",
              background: "white",
              color: "#1e293b",
              boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
            }}
          />
          <input
            value={url}
            onChange={e=>setUrl(e.target.value)}
            placeholder="Start URL (https://…)"
            style={{ 
              padding: "12px 16px", 
              borderRadius: 8, 
              border: "1px solid #d1d5db",
              fontSize: "14px",
              background: "white",
              color: "#1e293b",
              boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
            }}
          />
          <button
            onClick={openInEmbedded}
            style={{ 
              padding: "12px 20px", 
              borderRadius: 8, 
              border: "1px solid #d1d5db", 
              background: "#f8fafc",
              color: "#334155",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.2s",
              boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"}
            onMouseLeave={(e) => e.currentTarget.style.background = "#f8fafc"}
            title={electronDetected ? "Open in embedded browser" : "Electron not detected"}
          >
            Open
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={start}
              disabled={starting || !url || !goal}
              style={{
                padding: "8px 16px",
                backgroundColor: starting ? "#94a3b8" : "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: starting ? "not-allowed" : "pointer",
                fontSize: "14px",
                fontWeight: "500"
              }}
            >
              {starting ? "Starting..." : "Start"}
            </button>
            
            {/* 👈 Reset button to clear webview */}
            {webviewCreated && (
              <button
                onClick={reset}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  marginLeft: "8px"
                }}
              >
                Reset
              </button>
            )}
          </div>
        </div>
        <div style={{ 
          marginTop: "12px",
          fontSize: "13px", 
          color: "#475569",
          display: "flex",
          alignItems: "center",
          gap: "16px"
        }}>
          <span>
            {electronDetected ? "🟢 Electron: connected" : "🔴 Electron: not detected"}
          </span>
          <span>
            Status: <b style={{ color: "#1e293b" }}>{status}</b>
          </span>
          {runId && (
            <span>
              Run ID: <code style={{ 
                background: "#f1f5f9", 
                padding: "2px 6px", 
                borderRadius: "4px",
                fontSize: "12px",
                color: "#334155"
              }}>{runId.slice(0,8)}</code>
            </span>
          )}
          {/* 👈 Show background mode status */}
          {runId && events.some(e => e.type === "background.mode") && (
            <span style={{ 
              color: "#10b981", 
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}>
              🟢 <span>Background Agent Running</span>
            </span>
          )}
        </div>
      </div>

      {/* Two-pane layout with tabs */}
      <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 0, height: "100%" }}>
        {/* Left: Tabbed interface */}
        <div style={{ 
          background: "white", 
          borderRight: "1px solid #e2e8f0",
          display: "flex",
          flexDirection: "column",
          width: "420px",
          minWidth: "420px",
          maxWidth: "420px",
          overflow: "hidden",
          borderRadius: "0 0 12px 0"
        }}>
          {/* Tab navigation */}
          <div style={{ 
            display: "flex", 
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc",
            width: "100%",
            overflow: "hidden",
            padding: "8px 8px 0 8px"
          }}>
            {[
              { id: 'events', label: 'Events', icon: '📋' },
              { id: 'console', label: 'Console', icon: '💻' },
              { id: 'settings', label: 'Settings', icon: '⚙️' }
            ].map((tab, index) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  border: "none",
                  background: activeTab === tab.id ? "white" : "transparent",
                  color: activeTab === tab.id ? "#0f172a" : "#475569",
                  fontSize: "12px",
                  fontWeight: activeTab === tab.id ? "600" : "500",
                  cursor: "pointer",
                  borderRadius: "8px 8px 0 0",
                  marginRight: index < 2 ? "4px" : "0",
                  transition: "all 0.2s",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  textAlign: "center",
                  position: "relative",
                  zIndex: activeTab === tab.id ? 2 : 1
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ 
            flex: 1, 
            overflow: "auto",
            background: "white",
            borderRadius: "0 0 12px 0",
            margin: "0 8px 8px 8px"
          }}>
            {activeTab === 'events' && (
              <div style={{ padding: "16px" }}>
                <h3 style={{ 
                  marginTop: 0, 
                  marginBottom: "12px",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#0f172a"
                }}>
                  Event Log
                </h3>
                {events.length === 0 && (
                  <div style={{ 
                    opacity: 0.6, 
                    fontSize: "13px",
                    textAlign: "center",
                    padding: "40px 20px",
                    color: "#64748b"
                  }}>
                    No events yet. Start a run to see activity here.
                  </div>
                )}
                                 {events.map((e, i) => (
                   <div key={i} style={{ 
                     fontFamily: "ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace", 
                     fontSize: "12px", 
                     marginBottom: "8px",
                     padding: "6px 10px",
                     background: "#f8fafc",
                     borderRadius: "6px",
                     border: "1px solid #e2e8f0"
                   }}>
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center",
                      marginBottom: "4px"
                    }}>
                      <span style={{ 
                        fontWeight: "600",
                        color: e.type === "error" ? "#dc2626" : 
                               e.type === "blocked" ? "#d97706" :
                               e.type === "session.finished" ? "#059669" : 
                               e.type === "agent.action" ? "#7c3aed" :
                               e.type === "agent.navigation" ? "#0ea5e9" :
                               e.type === "agent.console" ? "#059669" :
                               e.type === "background.mode" ? "#10b981" :
                               "#0ea5e9"
                      }}>
                        {e.type}
                      </span>
                      {typeof e.idx === "number" && (
                        <span style={{ 
                          fontSize: "11px",
                          color: "#475569",
                          background: "#e2e8f0",
                          padding: "2px 6px",
                          borderRadius: "4px"
                        }}>
                          Episode {e.idx + 1}
                        </span>
                      )}
                    </div>
                    <div style={{ color: "#334155", lineHeight: "1.4" }}>
                      {/* 👈 Enhanced display for different event types */}
                      {e.type === "agent.action" ? (
                        <div>
                          <strong>{e.action}</strong>: {e.details}
                          {e.episode !== undefined && (
                            <span style={{ color: "#64748b", fontSize: "11px" }}>
                              {" "}(Episode {e.episode + 1})
                            </span>
                          )}
                        </div>
                      ) : e.type === "agent.navigation" ? (
                        <div>
                          <span style={{ color: "#0ea5e9" }}>→</span> {e.url}
                        </div>
                      ) : e.type === "agent.console" ? (
                        <div>
                          <span style={{ 
                            color: e.level === "error" ? "#dc2626" : 
                                   e.level === "warning" ? "#d97706" : "#059669",
                            fontWeight: "500"
                          }}>
                            [{e.level.toUpperCase()}]
                          </span> {e.text}
                        </div>
                      ) : e.type === "background.mode" ? (
                        <div style={{ color: "#10b981", fontWeight: "500" }}>
                          {e.message}
                        </div>
                      ) : (
                        e.url || e.message || e.text || (e.summary ? e.summary.slice(0,180) : "")
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'console' && (
              <div style={{ padding: "16px" }}>
                <h3 style={{ 
                  marginTop: 0, 
                  marginBottom: "12px",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#0f172a"
                }}>
                  Console Output
                </h3>
                <div style={{ 
                  background: "#0f172a", 
                  color: "#f8fafc",
                  padding: "12px",
                  borderRadius: "8px",
                  fontFamily: "ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace",
                  fontSize: "12px",
                  minHeight: "180px"
                }}>
                  <div style={{ color: "#10b981" }}>$ npm run dev:desktop</div>
                  <div style={{ color: "#fbbf24" }}>Starting Electron app...</div>
                  <div style={{ color: "#60a5fa" }}>API connected on port 8787</div>
                  <div style={{ color: "#a78bfa" }}>WebSocket ready at /ws</div>
                  <div style={{ color: "#94a3b8" }}>Ready for agent execution</div>
                </div>
              </div>
            )}

                        {activeTab === 'settings' && (
              <div style={{ padding: "16px" }}>
                <h3 style={{ 
                  marginTop: 0, 
                  marginBottom: "12px",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#0f172a"
                }}>
                  Configuration
                </h3>
                <div style={{ 
                  background: "#f8fafc",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0"
                }}>
                  <div style={{ marginBottom: "12px" }}>
                    <label style={{ 
                      display: "block", 
                      fontSize: "13px", 
                      fontWeight: "500",
                      marginBottom: "4px",
                      color: "#334155"
                    }}>
                      API Endpoint
                    </label>
                    <input 
                      value={API_BASE}
                      readOnly
                      style={{ 
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        border: "1px solid #d1d5db",
                        fontSize: "12px",
                        background: "#f1f5f9",
                        color: "#334155"
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: "12px" }}>
                    <label style={{ 
                      display: "block", 
                      fontSize: "13px", 
                      fontWeight: "500",
                      marginBottom: "4px",
                      color: "#334155"
                    }}>
                      Environment
                    </label>
                    <div style={{ 
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #d1d5db",
                      fontSize: "12px",
                      background: "#f1f5f9",
                      color: "#64748b"
                    }}>
                      {electronDetected ? "Desktop (Electron)" : "Web Browser"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Browser view or fallback */}
        <main style={{ 
          flex: 1, 
          display: "flex", 
          flexDirection: "column",
          margin: "0 8px 8px 0",
          width: "calc(100% - 16px)",
          height: "calc(100vh - 200px)",
          minHeight: "500px"
        }}>
          {electronDetected ? (
            webviewCreated ? (
              currentFrame ? (
                // 👈 Show live agent actions via screencast
                <img
                  src={currentFrame}
                  alt="Live agent actions"
                  style={{ 
                    width: "100%", 
                    height: "100%", 
                    objectFit: "contain",
                    borderRadius: "0 0 12px 12px"
                  }}
                />
              ) : (
                // 👈 Show webview when no frames are streaming
                <webview
                  ref={webviewRef}
                  src={url || "https://duckduckgo.com"}
                  style={{ 
                    width: "100%", 
                    height: "100%", 
                    border: "none",
                    borderRadius: "0 0 12px 12px",
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain"
                  }}
                  webpreferences="contextIsolation=yes,devTools=yes,webSecurity=no"
                  onLoadStart={() => console.log('Webview loading started')}
                  onLoad={() => console.log('Webview loaded')}
                  onError={(e) => console.log('Webview error:', e)}
                />
              )
            ) : (
              // 👈 Show placeholder when webview hasn't been created yet
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                backgroundColor: "#f8fafc",
                borderRadius: "0 0 12px 12px",
                border: "2px dashed #cbd5e1",
                color: "#64748b"
              }}>
                <div style={{ fontSize: "24px", marginBottom: "16px" }}>🌐</div>
                <div style={{ fontSize: "16px", fontWeight: "500", marginBottom: "8px" }}>
                  Ready to Start Agent
                </div>
                <div style={{ fontSize: "14px", textAlign: "center", maxWidth: "300px" }}>
                  Enter a URL and goal, then click "Start" to begin. The agent will run in this area.
                </div>
              </div>
            )
          ) : (
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              height: "100%",
              backgroundColor: "#f8fafc",
              borderRadius: "0 0 12px 12px",
              border: "2px dashed #cbd5e1",
              color: "#64748b"
            }}>
              <div>Loading...</div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}