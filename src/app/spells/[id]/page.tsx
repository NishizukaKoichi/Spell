import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Star, Zap, Clock } from 'lucide-react';
import { notFound } from 'next/navigation';
import { CastButton } from '@/components/cast-button';
import { SpellReviews } from '@/components/spell-reviews';

async function getSpell(id: string) {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/spells/${id}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    return null;
  }

  return res.json();
}

export default async function SpellDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const spell = await getSpell(id);

  if (!spell) {
    notFound();
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-bold">{spell.name}</h1>
                <Badge variant="outline">{spell.executionMode}</Badge>
              </div>
              <p className="text-lg text-white/60">{spell.description}</p>
              <p className="text-sm text-white/40">by {spell.author?.name || 'Unknown'}</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span>{spell.rating} / 5</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-white" />
              <span>{spell.totalCasts.toLocaleString()} casts</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span>v{spell.version}</span>
            </div>
          </div>
        </div>

        <Separator className="bg-white text-black/10" />

        {/* Details */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-white/10">
            <CardHeader>
              <h3 className="text-xl font-semibold">Pricing</h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">
                    ${(spell.priceAmountCents / 100).toFixed(2)}
                  </span>
                  <span className="text-white/60">
                    {spell.priceModel === 'one_time'
                      ? 'one-time'
                      : spell.priceModel === 'metered'
                        ? 'per use'
                        : 'per cast'}
                  </span>
                </div>
                <p className="text-sm text-white/60">{spell.priceCurrency} currency</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10">
            <CardHeader>
              <h3 className="text-xl font-semibold">Tags</h3>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {spell.tags.map((tag: string) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Long Description */}
        {spell.longDescription && (
          <Card className="border-white/10">
            <CardHeader>
              <h3 className="text-xl font-semibold">About this Spell</h3>
            </CardHeader>
            <CardContent>
              <p className="text-white/80 whitespace-pre-wrap">{spell.longDescription}</p>
            </CardContent>
          </Card>
        )}

        {/* Reviews */}
        <SpellReviews spellId={spell.id} />

        {/* Cast Button */}
        <div className="flex justify-end">
          <CastButton spellId={spell.id} priceAmountCents={spell.priceAmountCents} />
        </div>
      </div>
    </DashboardLayout>
  );
}
