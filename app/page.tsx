'use client';

import { useState, useEffect } from 'react';
import SplashScreen from '@/components/splash-screen';
import { PasskeyAuth } from '@/components/passkey-auth';
import { ChatInterface } from '@/components/chat-interface';

export default function Home() {
  const [step, setStep] = useState<'splash' | 'auth' | 'app'>('splash');

  useEffect(() => {
    // Show splash for 2.5 seconds then move to auth
    if (step === 'splash') {
      const timer = setTimeout(() => {
        setStep('auth');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [step]);

  if (step === 'splash') {
    return <SplashScreen />;
  }

  if (step === 'auth') {
    return <PasskeyAuth onAuthenticated={() => setStep('app')} />;
  }

  return <ChatInterface />;
}
