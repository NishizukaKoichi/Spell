import { Spell } from '@/types/spell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Star, Zap } from 'lucide-react'
import Link from 'next/link'

interface SpellCardProps {
  spell: Spell
}

export function SpellCard({ spell }: SpellCardProps) {
  const formatPrice = () => {
    const dollars = spell.price.amount / 100
    if (spell.price.model === 'one_time') {
      return `$${dollars.toFixed(2)} one-time`
    } else if (spell.price.model === 'metered') {
      return `$${dollars.toFixed(2)}/use`
    } else {
      return `$${dollars.toFixed(2)}/cast`
    }
  }

  const getModeColor = () => {
    switch (spell.executionMode) {
      case 'workflow':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20'
      case 'service':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20'
      case 'clone':
        return 'bg-green-500/10 text-green-600 border-green-500/20'
    }
  }

  return (
    <Card className="group transition-all hover:shadow-lg">
      <CardHeader>
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{spell.author.avatar}</span>
            <div className="text-sm">
              <p className="font-medium">{spell.author.name}</p>
            </div>
          </div>
          <Badge className={getModeColor()}>{spell.executionMode}</Badge>
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
          {spell.tags.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{spell.tags.length - 3}
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="font-medium">{spell.rating}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Zap className="h-4 w-4" />
            <span>{spell.totalCasts.toLocaleString()} casts</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <p className="text-lg font-bold">{formatPrice()}</p>
        <Link href={`/spells/${spell.id}`}>
          <Button>View Details</Button>
        </Link>
      </CardFooter>
    </Card>
  )
}
