'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { startAuthentication } from '@simplewebauthn/browser';

export default function SignInPage() {
  const [status, setStatus] = useState<'idle' | 'processing' | 'authenticated'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handlePasskeySignIn = async () => {
    setStatus('processing');
    setError(null);

    try {
      if (!window.PublicKeyCredential) {
        throw new Error('Passkeys are not supported in this browser');
      }

      // Get authentication options (no email needed for discoverable credentials)
      const optionsResponse = await fetch('/api/webauthn/auth-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // Empty body for discoverable credentials
      });

      if (!optionsResponse.ok) {
        const errorData = await optionsResponse.json();
        throw new Error(errorData.error || 'Failed to get authentication options');
      }

      const { options } = await optionsResponse.json();

      // Start WebAuthn authentication
      const authResponse = await startAuthentication(options);

      // Verify authentication and create session
      const verifyResponse = await fetch('/api/webauthn/auth-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: authResponse,
        }),
      });

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        throw new Error(errorData.error || 'Authentication failed');
      }

      await verifyResponse.json();

      setStatus('authenticated');

      // Redirect to home page
      window.location.href = '/';
    } catch (err) {
      console.error('[SignIn] Passkey authentication error:', err);

      // Check if it's a "no passkey found" error and redirect to signup
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
      if (
        errorMessage.includes('not found') ||
        errorMessage.includes('No passkeys') ||
        errorMessage.includes('NotAllowedError')
      ) {
        setError('No passkey found. Redirecting to signup...');
        setTimeout(() => {
          window.location.href = '/auth/signup';
        }, 2000);
      } else {
        setError(errorMessage);
      }
      setStatus('idle');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-8">
        {/* Authentication Button */}
        <div className="border border-white p-8 text-center">
          {error && (
            <div className="mb-6 p-3 border border-red-500 bg-red-500/10 text-red-400 text-sm">
              {error}
            </div>
          )}

          <Button
            onClick={handlePasskeySignIn}
            disabled={status === 'processing'}
            className="w-full border border-white bg-black text-white hover:bg-white hover:text-black transition-all py-6 text-lg font-mono"
          >
            {status === 'processing' ? 'PROCESSING...' : 'AUTHENTICATE'}
          </Button>
        </div>

        {/* Info */}
        <div className="text-center text-xs text-white/50 space-y-1">
          <div>Uses device biometric authentication</div>
          <div>Auto-register if new / Auto-login if existing</div>
        </div>
      </div>
    </div>
  );
}
