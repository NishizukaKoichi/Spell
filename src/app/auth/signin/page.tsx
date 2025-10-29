"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Zap } from "lucide-react";
import Link from "next/link";
import { startAuthentication } from "@simplewebauthn/browser";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignIn = async () => {
    if (!email) {
      setError("Email is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Get authentication options
      const optionsResponse = await fetch("/api/webauthn/auth-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!optionsResponse.ok) {
        const error = await optionsResponse.json();
        throw new Error(error.error || "Failed to get authentication options");
      }

      const { options } = await optionsResponse.json();

      // Start WebAuthn authentication
      const authResponse = await startAuthentication(options);

      // Verify authentication
      const verifyResponse = await fetch("/api/webauthn/auth-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          response: authResponse,
          challenge: options.challenge,
        }),
      });

      if (!verifyResponse.ok) {
        const error = await verifyResponse.json();
        throw new Error(error.error || "Authentication failed");
      }

      // Redirect to home page
      window.location.href = "/";
    } catch (err) {
      console.error("Authentication error:", err);
      setError(
        err instanceof Error ? err.message : "Authentication failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black via-black to-black p-4">
      <Card className="w-full max-w-md border-white/10">
        <CardHeader className="space-y-4 text-center">
          <Link href="/" className="mx-auto flex items-center gap-2">
            <Zap className="h-8 w-8 text-white" />
            <span className="text-2xl font-bold">Spell</span>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Welcome back</h1>
            <p className="text-sm text-white/60">
              Sign in with your passkey
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
              className="bg-white text-black/5 border-white/10"
              disabled={loading}
            />
          </div>

          <Button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full bg-white hover:bg-white text-black/90"
          >
            {loading ? "Signing in..." : "Sign in with Passkey"}
          </Button>

          <div className="text-center text-sm">
            <span className="text-white/60">Don't have an account? </span>
            <Link
              href="/auth/signup"
              className="text-white/80 hover:text-white"
            >
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
