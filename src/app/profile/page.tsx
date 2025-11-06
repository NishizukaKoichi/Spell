import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ApiKeys } from '@/components/api-keys';
import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { User, Mail, Calendar, Zap, History, Star } from 'lucide-react';
import Link from 'next/link';

async function getUserStats(userId: string) {
  const [spellCount, castCount, totalRevenue] = await Promise.all([
    prisma.spell.count({ where: { authorId: userId } }),
    prisma.cast.count({ where: { casterId: userId } }),
    prisma.cast.aggregate({
      where: { casterId: userId, status: 'succeeded' },
      _sum: { costCents: true },
    }),
  ]);

  return {
    spellCount,
    castCount,
    totalRevenue: totalRevenue._sum.costCents || 0,
  };
}

async function getUserAuthenticators(userId: string) {
  return prisma.authenticators.findMany({
    where: { userId },
    orderBy: { credentialID: 'asc' },
  });
}

async function getUserSpells(userId: string) {
  return prisma.spell.findMany({
    where: { authorId: userId },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
}

async function getUserCasts(userId: string) {
  return prisma.cast.findMany({
    where: { casterId: userId },
    include: {
      spell: {
        select: {
          id: true,
          name: true,
          category: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
}

export default async function ProfilePage() {
  const session = await auth();

  if (!session) {
    redirect('/auth/signin');
  }

  const [stats, authenticators, userSpells, userCasts] = await Promise.all([
    getUserStats(session.user.id),
    getUserAuthenticators(session.user.id),
    getUserSpells(session.user.id),
    getUserCasts(session.user.id),
  ]);

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Profile</h1>
          <p className="text-white/60">Manage your account and settings</p>
        </div>

        {/* User Information */}
        <Card className="border-white/10">
          <CardHeader>
            <h2 className="text-xl font-semibold">User Information</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black/10">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-medium">{session.user.name || 'User'}</p>
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Mail className="h-4 w-4" />
                  {session.user.email}
                </div>
              </div>
            </div>

            <Separator className="bg-white text-black/10" />

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Zap className="h-4 w-4" />
                  <span>Spells Created</span>
                </div>
                <p className="text-2xl font-bold">{stats.spellCount}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <History className="h-4 w-4" />
                  <span>Total Casts</span>
                </div>
                <p className="text-2xl font-bold">{stats.castCount}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Calendar className="h-4 w-4" />
                  <span>Total Spent</span>
                </div>
                <p className="text-2xl font-bold">${(stats.totalRevenue / 100).toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Passkeys */}
        <Card className="border-white/10">
          <CardHeader>
            <h2 className="text-xl font-semibold">Passkeys</h2>
            <p className="text-sm text-white/60">Manage your authentication passkeys</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {authenticators.length === 0 ? (
              <p className="text-white/60">No passkeys registered</p>
            ) : (
              <div className="space-y-3">
                {authenticators.map(
                  (
                    auth: {
                      credentialID: string;
                      credentialDeviceType: string;
                      credentialBackedUp: boolean;
                      counter: number;
                    },
                    index: number
                  ) => (
                    <div
                      key={auth.credentialID}
                      className="flex items-center justify-between rounded-lg border border-white/10 p-4"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">Passkey #{index + 1}</p>
                        <p className="text-xs text-white/40 font-mono">
                          {auth.credentialID.slice(0, 20)}...
                        </p>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-xs">
                            {auth.credentialDeviceType}
                          </Badge>
                          {auth.credentialBackedUp && (
                            <Badge variant="outline" className="text-xs">
                              Backed Up
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-white/60">Used {auth.counter} times</div>
                    </div>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Published Spells */}
        <Card className="border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Published Spells</h2>
              <Link href="/my-spells" className="text-sm text-white/80 hover:text-white">
                View all →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {userSpells.length === 0 ? (
              <p className="text-white/60 text-center py-8">No spells published yet</p>
            ) : (
              <div className="space-y-4">
                {userSpells.map(
                  (spell: {
                    id: string;
                    name: string;
                    description: string | null;
                    rating: number;
                    totalCasts: number;
                    category: string | null;
                    priceAmountCents: number;
                    priceModel: string;
                  }) => (
                    <Link key={spell.id} href={`/spells/${spell.id}`} className="block">
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white text-black/10 transition-colors">
                        <div className="flex-1">
                          <p className="font-semibold">{spell.name}</p>
                          <p className="text-sm text-white/60 line-clamp-1">{spell.description}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <div className="flex items-center gap-1 text-sm text-white/60">
                              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                              {spell.rating.toFixed(1)}
                            </div>
                            <div className="flex items-center gap-1 text-sm text-white/60">
                              <Zap className="h-3 w-3" />
                              {spell.totalCasts} casts
                            </div>
                            {spell.category && (
                              <Badge variant="outline" className="text-xs">
                                {spell.category}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            ${(spell.priceAmountCents / 100).toFixed(2)}
                          </p>
                          <p className="text-xs text-white/60">
                            {spell.priceModel === 'one_time' ? 'one-time' : 'per use'}
                          </p>
                        </div>
                      </div>
                    </Link>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Casts */}
        <Card className="border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Recent Casts</h2>
              <Link href="/casts" className="text-sm text-white/80 hover:text-white">
                View all →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {userCasts.length === 0 ? (
              <p className="text-white/60 text-center py-8">No casts yet</p>
            ) : (
              <div className="space-y-4">
                {userCasts.map(
                  (cast: {
                    id: string;
                    status: string;
                    createdAt: Date;
                    costCents: number;
                    spell: { name: string; category: string | null };
                  }) => (
                    <Link key={cast.id} href={`/casts/${cast.id}`} className="block">
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white text-black/10 transition-colors">
                        <div className="flex-1">
                          <p className="font-semibold">{cast.spell.name}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                cast.status === 'succeeded'
                                  ? 'text-green-500 border-green-500/20'
                                  : cast.status === 'failed'
                                    ? 'text-red-500 border-red-500/20'
                                    : cast.status === 'running'
                                      ? 'text-blue-500 border-blue-500/20'
                                      : 'text-yellow-500 border-yellow-500/20'
                              }`}
                            >
                              {cast.status === 'succeeded'
                                ? 'Completed'
                                : cast.status.charAt(0).toUpperCase() + cast.status.slice(1)}
                            </Badge>
                            {cast.spell.category && (
                              <Badge variant="outline" className="text-xs">
                                {cast.spell.category}
                              </Badge>
                            )}
                            <span className="text-xs text-white/60">
                              {new Date(cast.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">${(cast.costCents / 100).toFixed(2)}</p>
                        </div>
                      </div>
                    </Link>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* API Keys */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">API Keys</h2>
          <ApiKeys />
        </div>
      </div>
    </DashboardLayout>
  );
}
