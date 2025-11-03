'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Zap, BookOpen, History, User, LogOut, Menu, X } from 'lucide-react';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const toggleMobileMenu = () => setIsMobileMenuOpen((prev) => !prev);

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-black/70 px-4 backdrop-blur-lg lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-white" />
          <span className="text-lg font-semibold">Spell</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle navigation menu"
          onClick={toggleMobileMenu}
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {isMobileMenuOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <nav
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/10 bg-black/70 backdrop-blur-xl transition-transform duration-300',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0'
        )}
      >
        <div className="hidden h-16 items-center px-6 lg:flex">
          <Link href="/" className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-white" />
            <span className="text-xl font-bold">Spell</span>
          </Link>
        </div>

        <Separator className="bg-white/10" />

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
                    ? 'bg-white/10 text-white shadow-lg shadow-purple-500/10'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <Separator className="bg-white/10" />

        <div className="p-4">
          {session ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-white/5 px-4 py-2">
                <p className="text-xs uppercase tracking-wide text-white/50">Signed in as</p>
                <p className="text-sm font-medium text-white">{session.user?.email}</p>
              </div>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 border-white/20 text-white hover:bg-white/10"
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
    </>
  );
}
