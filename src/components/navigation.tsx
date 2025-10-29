'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Zap, BookOpen, History, User, LogOut } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Marketplace', icon: BookOpen },
  { href: '/my-spells', label: 'My Spells', icon: Zap },
  { href: '/casts', label: 'Cast History', icon: History },
  { href: '/profile', label: 'Profile', icon: User },
];

export function Navigation() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <nav className="fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-white/10 bg-black/50 backdrop-blur-xl">
      <div className="flex h-16 items-center px-6">
        <Link href="/" className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-white" />
          <span className="text-xl font-bold">Spell</span>
        </Link>
      </div>

      <Separator className="bg-white text-black/10" />

      <div className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>

      <Separator className="bg-white text-black/10" />

      <div className="p-4">
        {session ? (
          <div className="space-y-2">
            <div className="px-4 py-2">
              <p className="text-sm font-medium">{session.user?.email}</p>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={() => signOut()}
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </Button>
          </div>
        ) : (
          <Link href="/auth/signin">
            <Button variant="outline" className="w-full">
              Sign In
            </Button>
          </Link>
        )}
      </div>
    </nav>
  );
}
