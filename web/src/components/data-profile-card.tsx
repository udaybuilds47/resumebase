"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Upload, X } from "lucide-react"
import { FormField } from "@/components/form-field"
import { useState, useEffect } from "react"

interface DataProfileCardProps {
  isVisible: boolean
  onSave?: () => void
}

export function DataProfileCard({ isVisible, onSave }: DataProfileCardProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const removeFile = () => {
    setSelectedFile(null)
  }

  const [formData, setFormData] = useState({
    // Personal Information
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    linkedin: "",
    github: "",
    website: "",
    location: "",
    willingToRelocate: "",
    earliestStart: "",
    availability: "",
    
    // Professional Information
    currentTitle: "",
    yearsOfExperience: "",
    education: "",
    skills: "",
    coverLetter: "",
    
    // Application Preferences
    salaryExpectation: "",
    workAuthorization: "",
    noticePeriod: ""
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Load profile data from localStorage on mount
  useEffect(() => {
    const savedProfile = localStorage.getItem('resumebase-profile')
    if (savedProfile) {
      try {
        const profileData = JSON.parse(savedProfile)
        setFormData(profileData)
        console.log('Profile loaded from localStorage:', profileData)
      } catch (error) {
        console.error('Error loading profile from localStorage:', error)
      }
    }
  }, [])

  const handleSave = () => {
    // Save form data to localStorage
    const profileData = {
      ...formData,
      updatedAt: new Date().toISOString()
    }
    localStorage.setItem('resumebase-profile', JSON.stringify(profileData))
    console.log('Profile saved to localStorage:', profileData)
    toast.success("profile saved")
  }

  const handleReset = () => {
    setFormData({
      // Personal Information
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      linkedin: "",
      github: "",
      website: "",
      location: "",
      willingToRelocate: "",
      earliestStart: "",
      availability: "",
      
      // Professional Information
      currentTitle: "",
      yearsOfExperience: "",
      education: "",
      skills: "",
      coverLetter: "",
      
      // Application Preferences
      salaryExpectation: "",
      workAuthorization: "",
      noticePeriod: "",
    })
    setSelectedFile(null)
    localStorage.removeItem('resumebase-profile')
    toast.success("profile reset")
  }

  return (
    <Card className={`h-full rounded-lg bg-white py-0 ${
      isVisible ? "border border-gray-200 shadow-lg" : ""
    }`}>
      <CardContent className="p-4 pt-4 pb-6 overflow-y-auto">
        <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
          {/* Personal Information Section */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-semibold">profile</h3>

            <div className="flex items-center gap-2">
              {/* Hidden PDF input */}
              <input
                type="file"
                accept="application/pdf"
                id="profile-upload"
                className="hidden"
                onChange={handleFileChange}
              />

              <Button
                variant="outline"
                size="icon"
                className="flex-shrink-0 bg-transparent"
                type="button"
                onClick={() => document.getElementById("profile-upload")?.click()}
                title="upload resume"
              >
                <Upload className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                className=" bg-transparent"
                type="button"
                title="gmail"
                onClick={() => {
                  const base = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
                  window.location.href = `${base}/api/auth/gmail/connect`;
                }}
              >
                <img src="/gmail.png" alt="gmail" className="h-4 w-4 object-contain" />
              </Button>
            </div>
          </div>
          
          {/* File badge */}
          {selectedFile && (
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex items-center gap-2 text-sm bg-gray-100 px-3 py-1 rounded-md w-fit">
                <span>{selectedFile.name}</span>
                <button type="button" onClick={removeFile} className="text-gray-500 hover:text-red-500">
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
          
          {/* Basic Details Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">basic details</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
              <FormField
                id="firstName"
                label="first name"
                type="text"
                value={formData.firstName}
                onChange={(value) => handleInputChange('firstName', value)}
                placeholder="john"
              />
              <FormField
                id="lastName"
                label="last name"
                type="text"
                value={formData.lastName}
                onChange={(value) => handleInputChange('lastName', value)}
                placeholder="doe"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <FormField
                id="email"
                label="email"
                type="email"
                value={formData.email}
                onChange={(value) => handleInputChange('email', value)}
                placeholder="john.doe@example.com"
              />
              <FormField
                id="phone"
                label="phone"
                type="tel"
                value={formData.phone}
                onChange={(value) => handleInputChange('phone', value)}
                placeholder="123-456-7890"
              />
            </div>
            
            <FormField
              id="location"
              label="current location"
              type="text"
              value={formData.location}
              onChange={(value) => handleInputChange('location', value)}
              placeholder="san francisco, ca"
            />
            
            <FormField
              id="willingToRelocate"
              label="willing to relocate?"
              type="select"
              value={formData.willingToRelocate}
              onChange={(value) => handleInputChange('willingToRelocate', value)}
              options={[
                { value: "yes", label: "yes" },
                { value: "no", label: "no" },
                { value: "open to discussion", label: "open to discussion" }
              ]}
            />
            
            <div className="grid grid-cols-2 gap-3">
              <FormField
                id="linkedin"
                label="linkedin"
                type="url"
                value={formData.linkedin}
                onChange={(value) => handleInputChange('linkedin', value)}
                placeholder="https://linkedin.com/in/johndoe"
              />
              <FormField
                id="github"
                label="github"
                type="url"
                value={formData.github}
                onChange={(value) => handleInputChange('github', value)}
                placeholder="https://github.com/johndoe"
              />
            </div>
            
            <FormField
              id="website"
              label="portfolio website"
              type="url"
              value={formData.website}
              onChange={(value) => handleInputChange('website', value)}
              placeholder="https://johndoe.com"
            />
            </div>
          </div>

          {/* Professional Information Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">professional info</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  id="currentTitle"
                  label="current job title"
                  type="text"
                  value={formData.currentTitle}
                  onChange={(value) => handleInputChange('currentTitle', value)}
                  placeholder="software engineer"
                />
                <FormField
                  id="yearsOfExperience"
                  label="years of experience"
                  type="select"
                  value={formData.yearsOfExperience}
                  onChange={(value) => handleInputChange('yearsOfExperience', value)}
                  options={[
                    { value: "0-1", label: "0-1 years" },
                    { value: "1-3", label: "1-3 years" },
                    { value: "3-5", label: "3-5 years" },
                    { value: "5-10", label: "5-10 years" },
                    { value: "10+", label: "10+ years" }
                  ]}
                />
              </div>
              
              <FormField
                id="education"
                label="education"
                type="text"
                value={formData.education}
                onChange={(value) => handleInputChange('education', value)}
                placeholder="bachelor's in computer science"
              />
              
              <FormField
                id="skills"
                label="key skills"
                type="textarea"
                value={formData.skills}
                onChange={(value) => handleInputChange('skills', value)}
                placeholder="javascript, react, node.js, python, sql"
                rows={2}
              />
              
              <FormField
                id="coverLetter"
                label="cover letter"
                type="textarea"
                value={formData.coverLetter}
                onChange={(value) => handleInputChange('coverLetter', value)}
                placeholder="brief introduction about yourself and why you're interested in this role"
                rows={3}
              />
            </div>
          </div>

          {/* Application Preferences Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">application preferences</h3>
            <div className="space-y-4">
              <FormField
                id="earliestStart"
                label="earliest start date"
                type="text"
                value={formData.earliestStart}
                onChange={(value) => handleInputChange('earliestStart', value)}
                placeholder="immediately"
              />
              
              <FormField
                id="availability"
                label="availability"
                type="select"
                value={formData.availability}
                onChange={(value) => handleInputChange('availability', value)}
                options={[
                  { value: "immediately", label: "immediately" },
                  { value: "2 weeks notice", label: "2 weeks notice" },
                  { value: "1 month notice", label: "1 month notice" },
                  { value: "2+ months notice", label: "2+ months notice" }
                ]}
              />
              
              <FormField
                id="salaryExpectation"
                label="salary expectation"
                type="select"
                value={formData.salaryExpectation}
                onChange={(value) => handleInputChange('salaryExpectation', value)}
                options={[
                  { value: "based on the jd", label: "based on the jd" },
                  { value: "under $50k", label: "under $50k" },
                  { value: "$50k - $70k", label: "$50k - $70k" },
                  { value: "$70k - $90k", label: "$70k - $90k" },
                  { value: "$90k - $110k", label: "$90k - $110k" },
                  { value: "$110k - $130k", label: "$110k - $130k" },
                  { value: "$130k - $150k", label: "$130k - $150k" },
                  { value: "$150k - $180k", label: "$150k - $180k" },
                  { value: "$180k - $220k", label: "$180k - $220k" },
                  { value: "$220k - $250k", label: "$220k - $250k" },
                  { value: "$250k+", label: "$250k+" },
                  { value: "negotiable", label: "negotiable" },
                  { value: "not specified", label: "not specified" }
                ]}
              />
              
              <FormField
                id="workAuthorization"
                label="work authorization"
                type="select"
                value={formData.workAuthorization}
                onChange={(value) => handleInputChange('workAuthorization', value)}
                options={[
                  { value: "authorized to work", label: "authorized to work" },
                  { value: "need sponsorship", label: "need sponsorship" },
                  { value: "open to discussion", label: "open to discussion" }
                ]}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-gray-200 flex gap-2">
            <Button type="button" variant="outline" onClick={handleReset} className="w-1/2">
              reset
            </Button>
            <Button type="button" onClick={handleSave} className="w-1/2">
              save
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
