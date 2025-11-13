"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface PasskeyAuthProps {
  onAuthenticated: (username: string) => void
}

export function PasskeyAuth({ onAuthenticated }: PasskeyAuthProps) {
  const [status, setStatus] = useState<"idle" | "processing" | "authenticated">("idle")
  const [username, setUsername] = useState<string>("")

  const handlePasskey = async () => {
    setStatus("processing")

    try {
      if (!window.PublicKeyCredential) {
        alert("WebAuthn not supported")
        setStatus("idle")
        return
      }

      try {
        const credential = await navigator.credentials.get({
          publicKey: {
            challenge: new Uint8Array(32),
            rpId: window.location.hostname,
            userVerification: "required",
            timeout: 60000,
          },
        })

        if (credential) {
          const authenticatedUsername = "user_authenticated"
          setUsername(authenticatedUsername)
          setStatus("authenticated")
          onAuthenticated(authenticatedUsername)
          return
        }
      } catch {
        const credential = await navigator.credentials.create({
          publicKey: {
            challenge: new Uint8Array(32),
            rp: {
              name: "Secure Auth System",
              id: window.location.hostname,
            },
            user: {
              id: new Uint8Array(16),
              name: `user_${Date.now()}`,
              displayName: "New User",
            },
            pubKeyCredParams: [
              { alg: -7, type: "public-key" },
              { alg: -257, type: "public-key" },
            ],
            authenticatorSelection: {
              authenticatorAttachment: "platform",
              userVerification: "required",
            },
            timeout: 60000,
            attestation: "none",
          },
        })

        if (credential) {
          const newUsername = "new_user"
          setUsername(newUsername)
          setStatus("authenticated")
          onAuthenticated(newUsername)
        }
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
      setStatus("idle")
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-mono flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-8">
        {/* Authentication Button */}
        <div className="border border-foreground p-8 text-center">
          <Button
            onClick={handlePasskey}
            disabled={status === "processing"}
            className="w-full border border-foreground bg-background text-foreground hover:bg-foreground hover:text-background transition-all py-6 text-lg"
          >
            {status === "processing" ? "PROCESSING..." : "AUTHENTICATE"}
          </Button>
        </div>

        {/* Info */}
        <div className="text-center text-xs text-muted-foreground space-y-1">
          <div>Uses device biometric authentication</div>
          <div>Auto-register if new / Auto-login if existing</div>
        </div>
      </div>
    </div>
  )
}
