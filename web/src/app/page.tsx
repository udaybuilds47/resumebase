"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Paperclip, X } from "lucide-react";

interface SessionData {
  sessionId: string;
  viewerUrl?: string | null;
}

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadedFileUrl(null); // Reset uploaded URL when new file is selected
    }
  };

  const uploadFileToSupabase = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error("File upload error:", error);
      toast.error((`file upload failed: ${error instanceof Error ? error.message : "unknown error"}`).toLowerCase());
      return null;
    }
  };

  const handleApply = async () => {
    if (!inputValue.trim()) return;

    setIsLoading(true);
    try {
      let resumeUrl: string | undefined;

      // If a file is selected, upload it to Supabase first
      if (selectedFile) {
        toast.info("uploading resume...");
        const uploadedUrl = await uploadFileToSupabase(selectedFile);
        if (!uploadedUrl) {
          setIsLoading(false);
          return; // Stop if upload failed
        }
        resumeUrl = uploadedUrl;
        setUploadedFileUrl(uploadedUrl);
        toast.success("resume uploaded successfully!");
      }

      // Start the session with the resume URL if available
      const response = await fetch("/api/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          url: inputValue,
          resumeUrl: resumeUrl 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("Session started:", data);
        setSessionData({ sessionId: data.sessionId, viewerUrl: data.viewerUrl ?? null });
        toast.success(`resumebase session started! session id: ${data.sessionId}`);
        
        
        setInputValue(""); // Clear input after success
      } else {
        console.error("Failed to start session:", data.error);
        toast.error(`failed to start session: ${data.error}`);
      }
    } catch (error) {
      console.error("Error starting session:", error);
      toast.error("error starting session. please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setUploadedFileUrl(null);
  };

  return (
    <div className="h-screen bg-gray-50 overflow-hidden">
      {!sessionData ? (
        // Centered layout when no session
        <div className="h-full flex items-center justify-center p-4">
          <Card className="w-full max-w-5xl shadow-lg">
            <CardHeader className="pb-3">
              <h1 className="text-2xl font-semibold">resumebase</h1>
              <p className="text-muted-foreground text-sm">
                drop the link to the application here
              </p>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="flex gap-2">
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
                  {isLoading ? "starting..." : "apply"}
                </Button>
              </div>

              {/* File badge */}
              {selectedFile && (
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex items-center gap-2 text-sm bg-gray-100 px-3 py-1 rounded-md w-fit">
                    <span>{selectedFile.name}</span>
                    <button
                      onClick={removeFile}
                      className="text-gray-500 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>

                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        // Compact layout when session is active - both cards fit in one viewport
        <div className="h-full flex flex-col items-center p-4 gap-4">
          {/* Application Card - Top (compact) */}
          <div className="w-full flex justify-center">
            <Card className="w-full max-w-5xl shadow-lg flex-shrink-0">
              <CardHeader className="pb-3">
                <h1 className="text-2xl font-semibold">resumebase</h1>
                <p className="text-muted-foreground text-sm">
                  drop the link to the application here
                </p>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="flex gap-2">
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
                    id="resume-upload-session"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  {/* Paperclip opens file picker */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="flex-shrink-0"
                    onClick={() =>
                      document.getElementById("resume-upload-session")?.click()
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
                    {isLoading ? "starting..." : "apply"}
                  </Button>
                </div>

                {/* File badge */}
                {selectedFile && (
                  <div className="flex flex-col gap-2 mt-2">
                    <div className="flex items-center gap-2 text-sm bg-gray-100 px-3 py-1 rounded-md w-fit">
                      <span>{selectedFile.name}</span>
                      <button
                        onClick={removeFile}
                        className="text-gray-500 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Session Window - Below (takes remaining space) */}
          <div className="w-full flex justify-center flex-1 min-h-0">
            <Card className="w-full max-w-5xl shadow-lg flex flex-col min-h-0">
              <CardHeader className="flex-shrink-0 pb-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold">live session</h2>
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
                          toast.success("session stopped successfully");
                          setSessionData(null); // Clear session data
                        } else {
                          toast.error("failed to stop session");
                        }
                      } catch (error) {
                        console.error("Error stopping session:", error);
                        toast.error("error stopping session");
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
                <div className="w-full h-full p-4">
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