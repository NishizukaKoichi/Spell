'use client';

import { Loader2 } from 'lucide-react';

interface CastProgressProps {
  status: string;
  startedAt: string | null;
}

export function CastProgress({ status, startedAt }: CastProgressProps) {
  if (status !== 'running' && status !== 'queued') {
    return null;
  }

  const elapsed = startedAt ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000) : 0;

  const formatElapsed = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  return (
    <div className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
      <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-blue-500">
          {status === 'running' ? 'Execution in progress...' : 'Queued...'}
        </p>
        {startedAt && status === 'running' && (
          <p className="text-xs text-white/60 mt-1">Running for {formatElapsed(elapsed)}</p>
        )}
      </div>
      <div className="flex gap-1">
        <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
        <div
          className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"
          style={{ animationDelay: '0.2s' }}
        />
        <div
          className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"
          style={{ animationDelay: '0.4s' }}
        />
      </div>
    </div>
  );
}
