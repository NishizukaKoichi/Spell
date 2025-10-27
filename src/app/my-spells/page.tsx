import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SpellCard } from "@/components/spell-card";
import Link from "next/link";

async function getUserSpells(userId: string) {
  return prisma.spell.findMany({
    where: { authorId: userId },
    orderBy: { createdAt: "desc" },
  });
}

export default async function MySpellsPage() {
  const session = await auth();

  if (!session) {
    redirect("/auth/signin");
  }

  const spells = await getUserSpells(session.user.id);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">My Spells</h1>
            <p className="text-white/60">
              Manage and create your own spells
            </p>
          </div>
          <Link href="/my-spells/new">
            <Button className="gap-2 bg-purple-600 hover:bg-purple-700">
              <Plus className="h-5 w-5" />
              Create Spell
            </Button>
          </Link>
        </div>

        {spells.length === 0 ? (
          <Card className="border-white/10">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <p className="text-lg text-white/60 mb-4">
                You haven't created any spells yet
              </p>
              <Link href="/my-spells/new">
                <Button className="gap-2 bg-purple-600 hover:bg-purple-700">
                  <Plus className="h-5 w-5" />
                  Create Your First Spell
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {spells.map((spell) => (
              <SpellCard key={spell.id} spell={spell} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
