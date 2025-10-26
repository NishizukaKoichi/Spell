'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { mockSpells } from '@/lib/mock-data'
import {
  Star,
  Zap,
  ArrowLeft,
  Code2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react'

export default function SpellDetailPage() {
  const params = useParams()
  const spell = mockSpells.find((s) => s.id === params.id)
  const [showInputSchema, setShowInputSchema] = useState(false)
  const [showCastModal, setShowCastModal] = useState(false)

  if (!spell) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="mb-4 text-3xl font-bold">Spell Not Found</h1>
        <p className="mb-8 text-muted-foreground">
          The spell you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link href="/catalog">
          <Button>Browse Catalog</Button>
        </Link>
      </div>
    )
  }

  const formatPrice = () => {
    const dollars = spell.price.amount / 100
    if (spell.price.model === 'one_time') {
      return `$${dollars.toFixed(2)} one-time purchase`
    } else if (spell.price.model === 'metered') {
      return `$${dollars.toFixed(2)} per use`
    } else {
      return `$${dollars.toFixed(2)} per cast`
    }
  }

  const getModeDescription = () => {
    switch (spell.executionMode) {
      case 'workflow':
        return 'Executes via GitHub Actions workflow. Scheduled or event-triggered execution with full GitHub ecosystem integration.'
      case 'service':
        return 'Runs on WASM runtime. Ultra-low latency (<100ms) with automatic scaling and high availability.'
      case 'clone':
        return 'Buy once, own forever. Get the complete source code and self-host or customize as needed.'
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

  const exampleInputSchema = {
    width: 800,
    height: 600,
    format: 'webp',
    quality: 85,
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Back Button */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/catalog">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Catalog
            </Button>
          </Link>
        </div>
      </div>

      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex items-center gap-4">
              <span className="text-5xl">{spell.author.avatar}</span>
              <div>
                <p className="text-sm text-muted-foreground">Created by</p>
                <p className="text-lg font-semibold">{spell.author.name}</p>
              </div>
            </div>
            <Badge className={`${getModeColor()} px-4 py-2 text-sm`}>
              {spell.executionMode}
            </Badge>
          </div>

          <h1 className="mb-4 text-4xl font-bold">{spell.name}</h1>

          <div className="mb-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-5 w-5 ${
                      i < Math.floor(spell.rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <span className="text-lg font-semibold">{spell.rating}</span>
            </div>

            <Separator orientation="vertical" className="h-6" />

            <div className="flex items-center gap-2 text-muted-foreground">
              <Zap className="h-5 w-5" />
              <span className="text-lg">{spell.totalCasts.toLocaleString()} casts</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {spell.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column - Details */}
          <div className="lg:col-span-2">
            {/* Description */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-lg">{spell.description}</p>
                {spell.longDescription && (
                  <p className="text-muted-foreground">{spell.longDescription}</p>
                )}
              </CardContent>
            </Card>

            {/* Execution Mode */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Execution Mode
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`mb-4 inline-block rounded-lg border px-4 py-2 ${getModeColor()}`}
                >
                  <span className="text-lg font-semibold capitalize">
                    {spell.executionMode}
                  </span>
                </div>
                <p className="text-muted-foreground">{getModeDescription()}</p>
              </CardContent>
            </Card>

            {/* Input Schema */}
            <Card className="mb-6">
              <CardHeader>
                <button
                  onClick={() => setShowInputSchema(!showInputSchema)}
                  className="flex w-full items-center justify-between"
                >
                  <CardTitle className="flex items-center gap-2">
                    <Code2 className="h-5 w-5" />
                    Input Schema
                  </CardTitle>
                  {showInputSchema ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </button>
              </CardHeader>
              {showInputSchema && (
                <CardContent>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Example input format for this spell:
                  </p>
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                    {JSON.stringify(exampleInputSchema, null, 2)}
                  </pre>
                </CardContent>
              )}
            </Card>

            {/* Reviews */}
            <Card>
              <CardHeader>
                <CardTitle>Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                {spell.reviews && spell.reviews.length > 0 ? (
                  <div className="space-y-4">
                    {spell.reviews.map((review, index) => (
                      <div key={index} className="border-b pb-4 last:border-b-0">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="font-semibold">{review.user}</span>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < review.rating
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-muted-foreground">{review.comment}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No reviews yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Pricing & CTA */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <p className="mb-2 text-3xl font-bold">
                    {spell.price.model === 'one_time'
                      ? `$${(spell.price.amount / 100).toFixed(2)}`
                      : `$${(spell.price.amount / 100).toFixed(2)}`}
                  </p>
                  <p className="text-sm text-muted-foreground">{formatPrice()}</p>
                </div>

                <Button
                  className="mb-4 w-full"
                  size="lg"
                  onClick={() => setShowCastModal(true)}
                >
                  {spell.executionMode === 'clone' ? 'Buy Template' : 'Cast Now'}
                </Button>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>✓ Instant execution</p>
                  <p>✓ Secure WASM sandbox</p>
                  <p>✓ Full observability</p>
                  {spell.executionMode === 'clone' && <p>✓ Source code included</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Cast Modal (Simple version for now) */}
      {showCastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>
                {spell.executionMode === 'clone' ? 'Purchase Template' : 'Cast Spell'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-6 text-muted-foreground">
                {spell.executionMode === 'clone'
                  ? 'You will receive the complete source code and documentation via email after purchase.'
                  : 'This feature requires authentication. Sign in to cast spells.'}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowCastModal(false)}>
                  Cancel
                </Button>
                <Button className="flex-1">
                  {spell.executionMode === 'clone' ? 'Purchase Now' : 'Sign In to Cast'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
