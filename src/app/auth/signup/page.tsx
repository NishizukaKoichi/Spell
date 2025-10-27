"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Zap } from "lucide-react";
import Link from "next/link";
import { startRegistration } from "@simplewebauthn/browser";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignUp = async () => {
    if (!email) {
      setError("Email is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Get registration options
      const optionsResponse = await fetch("/api/webauthn/register-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!optionsResponse.ok) {
        const error = await optionsResponse.json();
        throw new Error(error.error || "Failed to get registration options");
      }

      const { options } = await optionsResponse.json();

      // Start WebAuthn registration
      const registrationResponse = await startRegistration(options);

      // Verify registration
      const verifyResponse = await fetch("/api/webauthn/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          response: registrationResponse,
          challenge: options.challenge,
        }),
      });

      if (!verifyResponse.ok) {
        const error = await verifyResponse.json();
        throw new Error(error.error || "Registration failed");
      }

      // Redirect to sign in page
      alert("Registration successful! Please sign in.");
      window.location.href = "/auth/signin";
    } catch (err) {
      console.error("Registration error:", err);
      setError(
        err instanceof Error ? err.message : "Registration failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-950 via-black to-indigo-950 p-4">
      <Card className="w-full max-w-md border-white/10">
        <CardHeader className="space-y-4 text-center">
          <Link href="/" className="mx-auto flex items-center gap-2">
            <Zap className="h-8 w-8 text-purple-500" />
            <span className="text-2xl font-bold">Spell</span>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Create your account</h1>
            <p className="text-sm text-white/60">
              Register with a passkey for secure authentication
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white/5 border-white/10"
              disabled={loading}
            />
          </div>

          <Button
            onClick={handleSignUp}
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {loading ? "Creating account..." : "Sign up with Passkey"}
          </Button>

          <div className="text-center text-sm">
            <span className="text-white/60">Already have an account? </span>
            <Link
              href="/auth/signin"
              className="text-purple-400 hover:text-purple-300"
            >
              Sign in
            </Link>
          </div>

          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-400">
            <p className="font-semibold mb-1">What is a passkey?</p>
            <p>
              A passkey is a secure, passwordless way to sign in. It uses your
              device's biometric authentication (like fingerprint or face
              recognition) or PIN.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
