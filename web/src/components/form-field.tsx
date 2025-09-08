"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface FormFieldProps {
  id: string
  label: string
  type: "text" | "email" | "tel" | "url" | "textarea" | "select"
  value: string
  onChange: (value: string) => void
  placeholder?: string
  options?: { value: string; label: string }[]
  rows?: number
  className?: string
}

export function FormField({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  options = [],
  rows = 2,
  className = ""
}: FormFieldProps) {
  const renderField = () => {
    switch (type) {
      case "textarea":
        return (
          <Textarea
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
          />
        )
      
      case "select":
        return (
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="[&>span]:text-muted-foreground">
              <SelectValue placeholder={placeholder || "select option"} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      
      default:
        return (
          <Input
            id={id}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
        )
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={id} className="text-muted-foreground text-sm">
        {label}
      </Label>
      {renderField()}
    </div>
  )
}
