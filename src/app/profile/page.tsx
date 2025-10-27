import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { User, Mail, Calendar, Zap, History } from "lucide-react";

async function getUserStats(userId: string) {
  const [spellCount, castCount, totalRevenue] = await Promise.all([
    prisma.spell.count({ where: { authorId: userId } }),
    prisma.cast.count({ where: { casterId: userId } }),
    prisma.cast.aggregate({
      where: { casterId: userId, status: "completed" },
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
    orderBy: { credentialID: "asc" },
  });
}

export default async function ProfilePage() {
  const session = await auth();

  if (!session) {
    redirect("/auth/signin");
  }

  const [stats, authenticators] = await Promise.all([
    getUserStats(session.user.id),
    getUserAuthenticators(session.user.id),
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
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/20">
                <User className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="font-medium">{session.user.name || "User"}</p>
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Mail className="h-4 w-4" />
                  {session.user.email}
                </div>
              </div>
            </div>

            <Separator className="bg-white/10" />

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
                <p className="text-2xl font-bold">
                  ${(stats.totalRevenue / 100).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Passkeys */}
        <Card className="border-white/10">
          <CardHeader>
            <h2 className="text-xl font-semibold">Passkeys</h2>
            <p className="text-sm text-white/60">
              Manage your authentication passkeys
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {authenticators.length === 0 ? (
              <p className="text-white/60">No passkeys registered</p>
            ) : (
              <div className="space-y-3">
                {authenticators.map((auth, index) => (
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
                    <div className="text-sm text-white/60">
                      Used {auth.counter} times
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* API Keys (Future) */}
        <Card className="border-white/10 opacity-50">
          <CardHeader>
            <h2 className="text-xl font-semibold">API Keys</h2>
            <p className="text-sm text-white/60">
              Manage API keys for programmatic access
            </p>
          </CardHeader>
          <CardContent>
            <p className="text-white/60">Coming soon...</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
