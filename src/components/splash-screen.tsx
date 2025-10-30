'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';

export default function SplashScreen() {
  const [isVisible, setIsVisible] = useState(false);
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    // Fade in animation
    setIsVisible(true);

    // Check auth status after showing splash screen
    const timer = setTimeout(() => {
      if (status === 'loading') return;

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
