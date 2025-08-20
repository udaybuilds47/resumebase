"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Paperclip, X } from "lucide-react";

interface SessionData {
  sessionId: string;
  url: string;
  status: string;
  timestamp: string;
  sessionUrl: string | null;
  viewerUrl?: string | null;
}

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleApply = async () => {
    if (!inputValue.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "start", url: inputValue }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("Session started:", data);
        setSessionData(data.session);
        toast.success(
          `Browserbase session started successfully! Session ID: ${data.session.sessionId}`
        );
        setInputValue(""); // Clear input after success
      } else {
        console.error("Failed to start session:", data.error);
        toast.error(`Failed to start session: ${data.error}`);
      }
    } catch (error) {
      console.error("Error starting session:", error);
      toast.error("Error starting session. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {!sessionData ? (
        // Centered layout when no session
        <div className="flex items-center justify-center min-h-screen">
          <Card className="w-full max-w-5xl shadow-lg">
            <CardHeader>
              <h1 className="text-3xl font-semibold">resumebase</h1>
              <p className="text-muted-foreground text-sm">
                drop the link to the application here
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2">
                <div className="flex gap-2 items-center">
                  <Input
                    type="search"
                    placeholder="Enter application URL..."
                    className="w-full"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleApply()}
                  />

                  {/* Hidden PDF input */}
                  <input
                    type="file"
                    accept="application/pdf"
                    id="resume-upload"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  {/* Paperclip opens file picker */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="flex-shrink-0"
                    onClick={() =>
                      document.getElementById("resume-upload")?.click()
                    }
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>

                  <Button
                    type="submit"
                    className="px-6"
                    onClick={handleApply}
                    disabled={isLoading}
                  >
                    {isLoading ? "Starting..." : "apply"}
                  </Button>
                </div>

                {/* File badge */}
                {selectedFile && (
                  <div className="flex items-center gap-2 text-sm bg-gray-100 px-3 py-1 rounded-md w-fit">
                    <span>{selectedFile.name}</span>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="text-gray-500 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        // Top layout when session is active
        <div className="h-screen flex flex-col p-4">
          {/* Application Card - Top */}
          <div className="flex justify-center mb-4">
            <Card className="w-full max-w-5xl shadow-lg">
              <CardHeader>
                <h1 className="text-3xl font-semibold">resumebase</h1>
                <p className="text-muted-foreground text-sm">
                  drop the link to the application here
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="search"
                    placeholder="Enter application URL..."
                    className="w-full"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleApply()}
                  />
                  <Button
                    type="submit"
                    className="px-6"
                    onClick={handleApply}
                    disabled={isLoading}
                  >
                    {isLoading ? "Starting..." : "apply"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Session Window - Below */}
          <div className="flex justify-center flex-1 min-h-0">
            <Card className="w-full max-w-5xl shadow-lg flex flex-col">
              <CardHeader className="flex-shrink-0">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold">Live Session</h2>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      try {
                        const response = await fetch("/api/session", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            action: "stop",
                            sessionId: sessionData.sessionId,
                          }),
                        });

                        if (response.ok) {
                          toast.success("Session stopped successfully");
                          setSessionData(null); // Clear session data
                        } else {
                          toast.error("Failed to stop session");
                        }
                      } catch (error) {
                        console.error("Error stopping session:", error);
                        toast.error("Error stopping session");
                      }
                    }}
                    className="px-4"
                  >
                    Stop Session
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 p-0">
                {/* Live Video Section */}
                <div className="w-full h-full p-6">
                  <div className="bg-black rounded-lg overflow-hidden w-full h-full">
                    {sessionData.viewerUrl ? (
                      <iframe
                        src={sessionData.viewerUrl}
                        className="w-full h-full"
                        title="Live Browser Session"
                        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                        allow="clipboard-read; clipboard-write; fullscreen"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white">
                        <div className="text-center">
                          <p className="text-lg font-medium">
                            Session Not Available
                          </p>
                          <p className="text-sm text-gray-300">
                            The live feed cannot be displayed
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}