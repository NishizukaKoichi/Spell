'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { SearchX, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-white/10">
        <CardHeader>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
              <SearchX className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">404 - Page Not Found</h1>
              <p className="text-sm text-white/60">The page you're looking for doesn't exist</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-white/80">
            The spell you're trying to cast might have been removed, or the URL might be incorrect.
          </p>

          <div className="flex gap-3">
            <Link href="/" className="flex-1">
              <Button className="w-full bg-white hover:bg-white text-black/90">
                <Home className="h-4 w-4 mr-2" />
                Go to Marketplace
              </Button>
            </Link>
            <Button onClick={() => window.history.back()} variant="outline" className="flex-1">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go back
            </Button>
          </div>

          <div className="pt-4 border-t border-white/10">
            <p className="text-sm font-medium mb-2">Quick links:</p>
            <div className="space-y-2">
              <Link href="/my-spells" className="block text-sm text-white/80 hover:text-white">
                → My Spells
              </Link>
              <Link href="/casts" className="block text-sm text-white/80 hover:text-white">
                → My Casts
              </Link>
              <Link href="/dashboard" className="block text-sm text-white/80 hover:text-white">
                → Dashboard
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
