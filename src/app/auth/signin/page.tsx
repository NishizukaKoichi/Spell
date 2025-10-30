'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Fingerprint, Loader2 } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';

export default function SignInPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePasskeySignIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!window.PublicKeyCredential) {
        throw new Error('Passkeys are not supported in this browser');
      }

      console.log('[SignIn] Starting passkey authentication');

      // Get authentication options
      const optionsResponse = await fetch('/api/webauthn/auth-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!optionsResponse.ok) {
        const errorData = await optionsResponse.json();
        throw new Error(errorData.error || 'Failed to get authentication options');
      }

      const { options } = await optionsResponse.json();

      // Start WebAuthn authentication
      const authResponse = await startAuthentication(options);

      // Verify authentication
      const verifyResponse = await fetch('/api/webauthn/auth-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: authResponse,
          challenge: options.challenge,
        }),
      });

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        throw new Error(errorData.error || 'Authentication failed');
      }

      // Redirect to dashboard
      window.location.href = '/dashboard';
    } catch (err) {
      console.error('[SignIn] Passkey authentication error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <Card className="p-8 space-y-6 border-border bg-card">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-semibold text-card-foreground">Sign In</h2>
            <p className="text-muted-foreground text-sm">Use biometrics or device PIN</p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive text-center">{error}</p>
            </div>
          )}

          <Button
            onClick={handlePasskeySignIn}
            disabled={isLoading}
            size="lg"
            className="w-full h-12 text-base font-medium"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Authenticating...
              </>
            ) : (
              <>
                <Fingerprint className="mr-2 h-5 w-5" />
                Sign in with Passkey
              </>
            )}
          </Button>

          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Passwordless authentication using fingerprint, face, or device PIN
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
