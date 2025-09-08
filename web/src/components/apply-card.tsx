"use client"

import type React from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Paperclip, X } from "lucide-react"
import { useRef } from "react"

export interface ApplyCardProps {
  inputValue: string
  onInputChange: (value: string) => void
  onApply: () => void
  isLoading: boolean
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  selectedFile: File | null
  onRemoveFile: () => void
}

export function ApplyCard({
  inputValue,
  onInputChange,
  onApply,
  isLoading,
  onFileChange,
  selectedFile,
  onRemoveFile,
}: ApplyCardProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">resumebase</h1>
          <div className="bg-white rounded-md p-1 shadow-sm border">
            <img src="/logo.png" alt="resumebase" className="h-8 w-auto" />
          </div>
        </div>
        <p className="text-muted-foreground text-sm">drop the link to the application here</p>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="flex gap-2">
          <Input
            type="search"
            placeholder="enter application url..."
            className="w-full"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && onApply()}
          />

          {/* Hidden PDF input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={onFileChange}
          />

          {/* Paperclip opens file picker */}
          <Button
            variant="outline"
            size="icon"
            className="flex-shrink-0 bg-transparent"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <Button type="button" className="px-6" onClick={onApply} disabled={isLoading}>
            {isLoading ? "starting..." : "apply"}
          </Button>
        </div>

        {/* File badge */}
        {selectedFile && (
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex items-center gap-2 text-sm bg-gray-100 px-3 py-1 rounded-md w-fit">
              <span>{selectedFile.name}</span>
              <button type="button" onClick={onRemoveFile} className="text-gray-500 hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}


