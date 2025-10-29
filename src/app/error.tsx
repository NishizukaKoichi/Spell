'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-white/10">
        <CardHeader>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Something went wrong!</h1>
              <p className="text-sm text-white/60">An unexpected error occurred</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-400 font-mono break-words">
              {error.message || 'Unknown error'}
            </p>
            {error.digest && <p className="text-xs text-white/40 mt-2">Error ID: {error.digest}</p>}
          </div>

          <div className="flex gap-3">
            <Button onClick={reset} className="flex-1 bg-white hover:bg-white text-black/90">
              Try again
            </Button>
            <Button
              onClick={() => (window.location.href = '/')}
              variant="outline"
              className="flex-1"
            >
              Go home
            </Button>
          </div>

          <p className="text-xs text-white/40 text-center">
            If this problem persists, please contact support
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
