'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { startRegistration } from '@simplewebauthn/browser';
import Image from 'next/image';

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
];

export default function SignUpPage() {
  const [status, setStatus] = useState<'idle' | 'processing' | 'authenticated'>('idle');
  const [error, setError] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);

  const handleLanguageSelect = (languageCode: string) => {
    setSelectedLanguage(languageCode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', languageCode);
      localStorage.setItem('hasVisited', 'true');
    }
  };

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

  // Show language selection first
  if (!selectedLanguage) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center p-8">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <Image
              src="/logo.png"
              alt="Spell Platform Logo"
              width={120}
              height={120}
              className="h-auto w-20 md:w-24 mx-auto mb-6"
              priority
            />
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Choose Your Language</h1>
            <p className="text-sm text-white/60">Select your preferred language to continue</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <Button
                key={lang.code}
                onClick={() => handleLanguageSelect(lang.code)}
                className="border border-white/20 bg-black text-white hover:bg-white hover:text-black transition-all py-6 text-base font-mono h-auto flex flex-col items-center gap-1"
              >
                <span className="font-bold">{lang.nativeName}</span>
                <span className="text-xs opacity-60">{lang.name}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // After language selection, show passkey registration
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
