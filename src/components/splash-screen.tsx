'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { Button } from './ui/button';

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

export default function SplashScreen() {
  const [isVisible, setIsVisible] = useState(false);
  const [showLanguageSelect, setShowLanguageSelect] = useState(false);
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    // Fade in animation
    setIsVisible(true);

    // Check if user has visited before
    const hasVisited = typeof window !== 'undefined' ? localStorage.getItem('hasVisited') : null;
    const savedLanguage = typeof window !== 'undefined' ? localStorage.getItem('language') : null;

    // Check auth status after showing splash screen
    const timer = setTimeout(() => {
      if (status === 'loading') return;

      // If user hasn't selected a language yet, show language selector
      if (!hasVisited && !savedLanguage && !session) {
        setShowLanguageSelect(true);
        return;
      }

      if (session) {
        // User is logged in, redirect to dashboard
        router.push('/dashboard');
      } else {
        // User is not logged in, redirect to sign in
        router.push('/auth/signin');
      }
    }, 2000); // Show splash for 2 seconds

    return () => clearTimeout(timer);
  }, [session, status, router]);

  const handleLanguageSelect = (languageCode: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', languageCode);
      localStorage.setItem('hasVisited', 'true');
    }
    router.push('/auth/signin');
  };

  if (showLanguageSelect) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white p-4">
        <div className={`max-w-2xl w-full transition-opacity duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className={`transition-opacity duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        <Image
          src="/logo.png"
          alt="Spell Platform Logo"
          width={300}
          height={300}
          className="h-auto w-32 md:w-40"
          priority
        />
      </div>
    </div>
  );
}
