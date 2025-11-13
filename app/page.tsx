"use client"

import { useState, useEffect } from "react"
import SplashScreen from "@/components/splash-screen"
import { LanguageSelection } from "@/components/language-selection"
import { PasskeyAuth } from "@/components/passkey-auth"
import { ChatInterface } from "@/components/chat-interface"

export default function Home() {
  const [step, setStep] = useState<"splash" | "language" | "auth" | "app">("splash")
  const [hasLanguagePreference, setHasLanguagePreference] = useState<boolean>(false)

  useEffect(() => {
    // Check if user has already set language preference
    const storedLanguage = localStorage.getItem("preferredLanguage")
    setHasLanguagePreference(!!storedLanguage)
  }, [])

  useEffect(() => {
    // Show splash for 2.5 seconds then move to next step
    if (step === "splash") {
      const timer = setTimeout(() => {
        // If user has no language preference, show language selection
        // Otherwise, skip directly to auth
        setStep(hasLanguagePreference ? "auth" : "language")
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [step, hasLanguagePreference])

  if (step === "splash") {
    return <SplashScreen />
  }

  if (step === "language") {
    return <LanguageSelection onLanguageSelected={() => setStep("auth")} />
  }

  if (step === "auth") {
    return <PasskeyAuth onAuthenticated={() => setStep("app")} />
  }

  return <ChatInterface />
}
