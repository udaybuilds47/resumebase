"use client";
import SessionReplay from "@/components/SessionReplay";

export default function DemoPage() {
  const sessionId = "a0337525-12fe-4dc1-ad11-d4e41313cc35";
  const serverUrl = "http://localhost:8787"; // Server is running on port 8787

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Session Replay Demo</h1>
          <p className="text-gray-600">
            Testing session replay functionality with session ID: {sessionId}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Server URL: {serverUrl}
          </p>
        </div>
        
        <SessionReplay 
          sessionId={sessionId} 
          serverUrl={serverUrl} 
        />
      </div>
    </div>
  );
}
