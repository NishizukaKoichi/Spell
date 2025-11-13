"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface LanguageSelectionProps {
  onLanguageSelected: (language: string) => void
}

export function LanguageSelection({ onLanguageSelected }: LanguageSelectionProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<string>("")

  const languages = [
    { code: "en", label: "English" },
    { code: "ja", label: "日本語" },
    { code: "es", label: "Español" },
    { code: "fr", label: "Français" },
    { code: "de", label: "Deutsch" },
    { code: "ko", label: "한국어" },
    { code: "pt", label: "Português" },
    { code: "ru", label: "Русский" },
    { code: "hi", label: "हिन्दी" },
    { code: "it", label: "Italiano" },
  ]

  const handleConfirm = () => {
    if (selectedLanguage) {
      localStorage.setItem("preferredLanguage", selectedLanguage)
      onLanguageSelected(selectedLanguage)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-mono flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="border border-foreground p-6 text-center">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-foreground rounded-full animate-pulse" />
              <span className="text-xs">SETUP.LANGUAGE</span>
            </div>
          </div>
          <h1 className="text-3xl mb-2">{">"} SELECT_LANGUAGE</h1>
          <p className="text-xs text-muted-foreground">[Choose your preferred language]</p>
        </div>

        {/* Language Options */}
        <div className="border border-foreground p-6">
          <div className="space-y-3">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setSelectedLanguage(lang.code)}
                className={`w-full border border-foreground p-4 text-left transition-all ${
                  selectedLanguage === lang.code
                    ? "bg-foreground text-background"
                    : "bg-background text-foreground hover:bg-foreground hover:text-background"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg">{lang.label}</span>
                  {selectedLanguage === lang.code && (
                    <span className="text-sm">{">"} SELECTED</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Confirm Button */}
        <Button
          onClick={handleConfirm}
          disabled={!selectedLanguage}
          className="w-full border border-foreground bg-background text-foreground hover:bg-foreground hover:text-background transition-all py-6 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {selectedLanguage ? "CONFIRM" : "SELECT_A_LANGUAGE"}
        </Button>
      </div>
    </div>
  )
}
