'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface HomePageProps {
  username: string;
}

export function HomePage({ username }: HomePageProps) {
  const [currentTime] = useState(new Date().toLocaleString());

  const handleLogout = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-mono flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="border border-foreground p-6 text-center">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-foreground rounded-full animate-pulse" />
              <span className="text-xs">SESSION.ACTIVE</span>
            </div>
            <span className="text-xs">{currentTime}</span>
          </div>
          <h1 className="text-3xl mb-2">{'>'} SECURE_TERMINAL</h1>
          <p className="text-xs text-muted-foreground">[Authenticated Session]</p>
        </div>

        {/* User Info */}
        <div className="border border-foreground p-6">
          <div className="text-sm space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">USER:</span>
              <span className="text-foreground">{username}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">STATUS:</span>
              <span className="text-foreground">ACTIVE</span>
            </div>
          </div>
        </div>

        {/* Logout */}
        <Button
          onClick={handleLogout}
          className="w-full border border-foreground bg-background text-foreground hover:bg-foreground hover:text-background transition-all py-6"
        >
          LOGOUT
        </Button>
      </div>
    </div>
  );
}
