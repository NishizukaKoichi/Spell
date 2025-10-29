import { Spell } from '@/types/spell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import Link from 'next/link';

interface SpellCardProps {
  spell: Spell;
}

export function SpellCard({ spell }: SpellCardProps) {
  const formatPrice = () => {
    const dollars = spell.priceAmount / 100;
    if (spell.priceModel === 'one_time') {
      return `$${dollars.toFixed(2)} one-time`;
    } else if (spell.priceModel === 'metered') {
      return `$${dollars.toFixed(2)}/use`;
    } else {
      return `$${dollars.toFixed(2)}/cast`;
    }
  };

  return (
    <Card className="group border-white/10 transition-all hover:border-white/30">
      <CardHeader>
        <div className="mb-3 flex items-start justify-between">
          <div className="text-sm">
            <p className="text-muted-foreground">By Author</p>
          </div>
          <Badge variant="outline">{spell.executionMode}</Badge>
        </div>
        <h3 className="text-xl font-bold">{spell.name}</h3>
        <p className="text-sm text-muted-foreground">{spell.description}</p>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-2">
          {spell.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{spell.rating} / 5</span>
          <span>{spell.totalCasts.toLocaleString()} casts</span>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <p className="font-mono text-sm">{formatPrice()}</p>
        <Link href={`/spells/${spell.id}`}>
          <Button variant="outline" size="sm">
            View
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
