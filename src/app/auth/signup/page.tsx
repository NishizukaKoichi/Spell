'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { startRegistration } from '@simplewebauthn/browser';

export default function SignUpPage() {
  const [status, setStatus] = useState<'idle' | 'processing' | 'authenticated'>('idle');
  const [error, setError] = useState('');

  const handleSignUp = async () => {
    setStatus('processing');
    setError('');

    try {
      // Get registration options (passkey only, no email needed)
      const optionsResponse = await fetch('/api/webauthn/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!optionsResponse.ok) {
        const error = await optionsResponse.json();
        throw new Error(error.error || 'Failed to get registration options');
      }

      const { options } = await optionsResponse.json();

      // Start WebAuthn registration
      const registrationResponse = await startRegistration(options);

      // Verify registration
      const verifyResponse = await fetch('/api/webauthn/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: registrationResponse,
        }),
      });

      if (!verifyResponse.ok) {
        const error = await verifyResponse.json();
        throw new Error(error.error || 'Registration failed');
      }

      await verifyResponse.json();

      setStatus('authenticated');

      // Redirect to home page (user is now logged in automatically)
      window.location.href = '/';
    } catch (err) {
      console.error('Registration error:', err);
      setError(err instanceof Error ? err.message : 'Registration failed');
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
            onClick={handleSignUp}
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
