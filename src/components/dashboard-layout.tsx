'use client';

import { Navigation } from '@/components/navigation';
import { ReactNode } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-black to-black">
      <Navigation />
      <main className="ml-64 min-h-screen p-8">{children}</main>
    </div>
  );
}
