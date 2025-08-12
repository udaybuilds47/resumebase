"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface SessionReplayProps {
  sessionId: string;
  serverUrl: string;
  isFetching?: boolean;
}

interface RecordingData {
  events: any[];
  sessionId: string;
}

export default function SessionReplay({ sessionId, serverUrl, isFetching }: SessionReplayProps) {
  const [recording, setRecording] = useState<RecordingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchRecording = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log(`Fetching recording from: ${serverUrl}/recording/${sessionId}`);
        const response = await fetch(`${serverUrl}/recording/${sessionId}`);
        console.log(`Response status: ${response.status}, ok: ${response.ok}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Recording not ready yet, still processing...");
          }
          throw new Error(`Failed to fetch recording: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("Recording data received:", data);
        console.log("Events count:", data.events?.length || 0);
        
        // Check if we have valid recording data
        if (!data.events || data.events.length === 0) {
          console.log(`Recording empty (attempt ${retryCount + 1}/5), will retry...`);
          if (retryCount >= 4) {
            // Don't throw error, just set a user-friendly message
            setError("Recording is still processing. Please wait a moment and try again.");
            setLoading(false);
            return;
          }
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, 5000);
          return;
        }
        
        if (data.events.length < 2) {
          console.log(`Recording has insufficient events: ${data.events.length} (attempt ${retryCount + 1}/5), will retry...`);
          if (retryCount >= 4) {
            // Don't throw error, just set a user-friendly message
            setError("Recording needs more events to play. Please wait a moment and try again.");
            setLoading(false);
            return;
          }
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, 5000);
          return;
        }
        
        // Check if recording is disabled for this site
        if (data.disabled || data.error === 'recording_disabled') {
          setError("Recording is disabled for this site");
          setLoading(false);
          return;
        }
        
        // Recording is ready - stop fetching
        setRecording(data);
        setError(null);
        setLoading(false);
        console.log('Recording found and ready, stopping fetch attempts');
      } catch (err: any) {
        console.error("Recording fetch error:", err);
        
        // Handle network errors or unexpected errors
        if (err.message.includes('still processing') || err.message.includes('not ready')) {
          // Retry logic for processing recordings
          if (retryCount < 5) {
            setTimeout(() => {
              setRetryCount(prev => prev + 1);
            }, 5000);
          } else {
            setError("Recording is taking longer than expected. Please wait and try again.");
            setLoading(false);
          }
        } else if (err.message.includes('disabled')) {
          setError(err.message);
          setLoading(false);
        } else {
          setError("Unable to fetch recording. Please check your connection and try again.");
          setLoading(false);
        }
      }
    };

    if (sessionId) {
      fetchRecording();
    }
  }, [sessionId, serverUrl, retryCount]);

  useEffect(() => {
    if (!recording || !containerRef.current) return;

    let ro: ResizeObserver | null = null;

    const initPlayer = async () => {
      try {
        // Validate that we have enough events for the player
        if (!recording.events || recording.events.length < 2) {
          throw new Error(`Recording needs at least 2 events, but only has ${recording.events?.length || 0}`);
        }

        const { default: rrwebPlayer } = await import("rrweb-player");
        await import("rrweb-player/dist/style.css");

        const container = containerRef.current!;
        
        // Clear any existing content
        container.innerHTML = '';
        
        // Set up container styles for proper containment
        container.style.position = "relative";
        container.style.overflow = "hidden";
        container.style.display = "block";
        container.style.boxSizing = "border-box";
        container.style.width = "100%";
        container.style.height = "100%";

        // Get container dimensions
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        console.log('Container dimensions:', { containerWidth, containerHeight });

        // Create player with constrained sizing - KEY FIXES:
        const p = new rrwebPlayer({
          target: container,
          props: {
            events: recording.events,
            // Don't set width/height - let it be responsive
            maxScale: 1,                 // ✅ Limit scaling to prevent overflow
            skipInactive: true,
            showController: true,
            autoPlay: false,
            // Add these props to help with sizing
            insertStyleRules: [
              // Force the player to respect container bounds
              '.rr-player { max-width: 100% !important; max-height: 100% !important; }',
              '.rr-player .rr-player__frame { max-width: 100% !important; max-height: 100% !important; }',
              // Ensure controller doesn't overflow
              '.rr-controller { max-width: 100% !important; }',
            ],
          },
        });
        
        playerRef.current = p;

                 // Apply size constraints after player is created
         const applyConstraints = () => {
           // Safety check - ensure player still exists
           if (!playerRef.current || playerRef.current.destroyed) {
             return;
           }
           
           const playerElement = container.querySelector(".rr-player") as HTMLElement;
           const frameElement = container.querySelector(".rr-player__frame") as HTMLElement;
           
           if (playerElement) {
             playerElement.style.maxWidth = "100%";
             playerElement.style.maxHeight = "100%";
             playerElement.style.overflow = "hidden";
           }
           
           if (frameElement) {
             frameElement.style.maxWidth = "100%";
             frameElement.style.maxHeight = "100%";
             frameElement.style.overflow = "hidden";
           }
           
           // Trigger resize to recalculate
           if (playerRef.current?.triggerResize) {
             try {
               playerRef.current.triggerResize();
             } catch (e) {
               console.warn("Error triggering resize:", e);
             }
           }
         };

        // Apply constraints after a brief delay to ensure DOM is ready
        setTimeout(applyConstraints, 100);

        // Set up ResizeObserver for responsive behavior
        ro = new ResizeObserver(() => {
          // Check if player still exists before applying constraints
          if (playerRef.current && !playerRef.current.destroyed) {
            requestAnimationFrame(() => {
              applyConstraints();
              console.log('ResizeObserver triggered, container size:', {
                width: container.clientWidth,
                height: container.clientHeight
              });
            });
          }
        });
        ro.observe(container);

        // Add event listeners
        playerRef.current.addEventListener("play", () => console.log("Replay started"));
        playerRef.current.addEventListener("pause", () => console.log("Replay paused"));
        playerRef.current.addEventListener("finish", () => console.log("Replay finished"));
        
      } catch (err) {
        console.error("Failed to initialize rrweb player:", err);
        setError(err instanceof Error ? err.message : "Failed to initialize replay player");
      }
    };

    initPlayer();

    // Cleanup function
    return () => {
      // Disconnect ResizeObserver first
      if (ro) {
        ro.disconnect();
        ro = null;
      }
      
      // Clean up player
      if (playerRef.current) {
        try {
          // Remove event listeners first
          playerRef.current.removeEventListener?.("play", () => {});
          playerRef.current.removeEventListener?.("pause", () => {});
          playerRef.current.removeEventListener?.("finish", () => {});
          
          // Destroy the player
          playerRef.current.destroy();
        } catch (e) {
          console.warn("Error destroying player:", e);
        } finally {
          playerRef.current = null;
        }
      }
      
      // Clear container content
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [recording]);

  const handleRetry = () => {
    setRetryCount(0);
    setError(null);
  };

  // Show simple loading spinner for all states except when replay is ready
  if (!recording || !recording.events || recording.events.length < 2) {
    return (
          <div className="w-full flex-1 flex items-center justify-center"> 
          <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-400 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show the actual replay player only when recording is fully ready
  return (
    <div className="w-full h-full">
      <div 
        ref={containerRef} 
        className="border border-gray-200 rounded-lg bg-white relative w-full h-full"
        style={{ 
          minHeight: '400px',
          maxWidth: '100%',
          maxHeight: '100%',
          overflow: 'hidden' // Additional safety
        }}
      />
    </div>
  );
}