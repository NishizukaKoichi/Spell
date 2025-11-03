'use client';

import { Navigation } from '@/components/navigation';
import { ReactNode } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-black via-zinc-950 to-black text-white">
      <Navigation />
      <main className="min-h-screen px-4 pb-12 pt-20 transition-all duration-200 lg:ml-64 lg:px-8 lg:pb-12 lg:pt-10">
        {children}
      </main>
    </div>
  );
}
