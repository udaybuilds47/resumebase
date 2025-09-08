"use client"

import type React from "react"
import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Paperclip, X, User } from "lucide-react"
import { DataProfileCard } from "@/components/data-profile-card"
import { ApplyCard } from "@/components/apply-card"

interface SessionData {
  sessionId: string
  viewerUrl?: string | null
}

// Layout constants
const SIDEBAR_WIDTH = '20rem' // 320px
const SIDEBAR_GAP = '1rem' // 16px gap between sidebar and main content
const CONTAINER_MARGIN = '0.5rem' // 8px margin

export default function Home() {
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null)
  const [showDataProfile, setShowDataProfile] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
      setUploadedFileUrl(null) // Reset uploaded URL when new file is selected
    }
  }

  const uploadFileToSupabase = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Upload failed")
      }

      const data = await response.json()
      return data.url
    } catch (error) {
      console.error("File upload error:", error)
      toast.error(`file upload failed: ${error instanceof Error ? error.message : "unknown error"}`.toLowerCase())
      return null
    }
  }

  const handleApply = async () => {
    if (!inputValue.trim()) return

    setIsLoading(true)
    try {
      let resumeUrl: string | undefined

      // If a file is selected, upload it to Supabase first
      if (selectedFile) {
        toast.info("uploading resume...")
        const uploadedUrl = await uploadFileToSupabase(selectedFile)
        if (!uploadedUrl) {
          setIsLoading(false)
          return // Stop if upload failed
        }
        resumeUrl = uploadedUrl
        setUploadedFileUrl(uploadedUrl)
        toast.success("resume uploaded successfully!")
      }

      // Get profile data from localStorage
      const profileData = localStorage.getItem('resumebase-profile')
      let dataProfile = null
      if (profileData) {
        try {
          dataProfile = JSON.parse(profileData)
          console.log('Sending profile data to agent:', dataProfile)
        } catch (error) {
          console.error('Error parsing profile data:', error)
        }
      }

      // Start the session with the resume URL and profile data
      const response = await fetch("/api/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobUrl: inputValue,
          resumeUrl: resumeUrl,
          dataProfile: dataProfile,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        console.log("Session started:", data)
        setSessionData({ sessionId: data.sessionId, viewerUrl: data.viewerUrl ?? null })
        toast.success(`resumebase session started! session id: ${data.sessionId}`)

        setInputValue("") // Clear input after success
      } else {
        console.error("Failed to start session:", data.error)
        toast.error(`failed to start session: ${data.error}`)
      }
    } catch (error) {
      console.error("Error starting session:", error)
      toast.error("error starting session. please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const removeFile = () => {
    setSelectedFile(null)
    setUploadedFileUrl(null)
  }

  return (
    <div className="h-screen bg-gray-50 overflow-hidden relative">
      {/* Data Profile Card - Sliding from right */}
      <div
        className={`fixed right-0 top-0 w-80 z-50 transform transition-transform duration-300 ease-in-out ${
          showDataProfile ? "translate-x-0" : "translate-x-full"
        } ${!showDataProfile ? "pointer-events-none" : ""}`}
        style={{ 
          height: "calc(100vh - 1rem)",
          marginTop: "0.5rem",
          marginRight: "0.5rem",
          opacity: showDataProfile ? 1 : 0
        }}
      >
        <DataProfileCard isVisible={showDataProfile} />
      </div>

      {/* Main content with dynamic width */}
      <div
        className="transition-all duration-300 ease-in-out border border-gray-200 rounded-lg mt-2 mb-2 relative shadow-lg bg-white"
        style={{
          height: "calc(100vh - 1rem)",
          marginLeft: "0.5rem",
          marginRight: showDataProfile ? "21rem" : "0.5rem", // 20rem (card) + 1rem (gap)
        }}
      >
        {/* Profile Panel Button - Top Right */}
        <Button
          variant="outline"
          size="icon"
          className="absolute top-4 right-4 z-30 flex-shrink-0 bg-transparent"
          onClick={() => setShowDataProfile(!showDataProfile)}
          title={showDataProfile ? "Hide Profile" : "Show Profile"}
        >
          <User className="h-4 w-4" />
        </Button>

      {!sessionData ? (
        // Centered layout when no session
        <div className="h-full flex items-center justify-center p-4">
          <div className="w-full max-w-5xl space-y-4">
            <ApplyCard
              inputValue={inputValue}
              onInputChange={setInputValue}
              onApply={handleApply}
              isLoading={isLoading}
              onFileChange={handleFileChange}
              selectedFile={selectedFile}
              onRemoveFile={removeFile}
            />
          </div>
        </div>
      ) : (
        // Compact layout when session is active - both cards fit in one viewport
        <div className="h-full flex flex-col items-center p-4 gap-4">
          {/* Application Card - Top (compact) */}
          <div className="w-full flex justify-center">
            <div className="w-full max-w-5xl flex-shrink-0">
              <ApplyCard
                inputValue={inputValue}
                onInputChange={setInputValue}
                onApply={handleApply}
                isLoading={isLoading}
                onFileChange={handleFileChange}
                selectedFile={selectedFile}
                onRemoveFile={removeFile}
              />
            </div>
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
                        })

                        if (response.ok) {
                          toast.success("session stopped successfully")
                          setSessionData(null) // Clear session data
                        } else {
                          toast.error("failed to stop session")
                        }
                      } catch (error) {
                        console.error("Error stopping session:", error)
                        toast.error("error stopping session")
                      }
                    }}
                    className="px-4"
                  >
                    stop
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
                          <p className="text-lg font-medium">Session Not Available</p>
                          <p className="text-sm text-gray-300">The live feed cannot be displayed</p>
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
    </div>
  )
}
