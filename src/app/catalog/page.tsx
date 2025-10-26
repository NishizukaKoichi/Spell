'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { SpellCard } from '@/components/spell-card'
import { mockSpells } from '@/lib/mock-data'
import { Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react'

const ITEMS_PER_PAGE = 6

const allTags = Array.from(new Set(mockSpells.flatMap((spell) => spell.tags))).sort()
const executionModes = ['workflow', 'service', 'clone'] as const
const priceRanges = [
  { label: 'Free', min: 0, max: 0 },
  { label: '< $0.10', min: 1, max: 10 },
  { label: '< $1.00', min: 10, max: 100 },
  { label: '> $1.00', min: 100, max: Infinity },
]

export default function CatalogPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedModes, setSelectedModes] = useState<string[]>([])
  const [selectedPriceRange, setSelectedPriceRange] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [showFilters, setShowFilters] = useState(true)

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
    setCurrentPage(1)
  }

  const toggleMode = (mode: string) => {
    setSelectedModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode],
    )
    setCurrentPage(1)
  }

  const togglePriceRange = (index: number) => {
    setSelectedPriceRange(selectedPriceRange === index ? null : index)
    setCurrentPage(1)
  }

  const clearFilters = () => {
    setSelectedTags([])
    setSelectedModes([])
    setSelectedPriceRange(null)
    setSearchQuery('')
    setCurrentPage(1)
  }

  const filteredSpells = useMemo(() => {
    return mockSpells.filter((spell) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSearch =
          spell.name.toLowerCase().includes(query) ||
          spell.description.toLowerCase().includes(query) ||
          spell.tags.some((tag) => tag.toLowerCase().includes(query))
        if (!matchesSearch) return false
      }

      // Tag filter
      if (selectedTags.length > 0) {
        const hasSelectedTag = selectedTags.some((tag) => spell.tags.includes(tag))
        if (!hasSelectedTag) return false
      }

      // Execution mode filter
      if (selectedModes.length > 0) {
        if (!selectedModes.includes(spell.executionMode)) return false
      }

      // Price filter
      if (selectedPriceRange !== null) {
        const range = priceRanges[selectedPriceRange]
        if (spell.price.amount < range.min || spell.price.amount > range.max) {
          return false
        }
      }

      return true
    })
  }, [searchQuery, selectedTags, selectedModes, selectedPriceRange])

  const totalPages = Math.ceil(filteredSpells.length / ITEMS_PER_PAGE)
  const paginatedSpells = filteredSpells.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  )

  const activeFiltersCount =
    selectedTags.length + selectedModes.length + (selectedPriceRange !== null ? 1 : 0)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-8">
          <h1 className="mb-2 text-4xl font-bold">Spell Catalog</h1>
          <p className="text-lg text-muted-foreground">
            Discover and execute powerful WASM workflows
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Search Bar */}
        <div className="mb-6 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search spells by name, description, or tags..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </div>

        <div className="flex gap-8">
          {/* Filters Sidebar */}
          {showFilters && (
            <Card className="h-fit w-64 shrink-0">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Filters</CardTitle>
                  {activeFiltersCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground"
                    >
                      Clear all
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Tags */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag) => (
                      <Badge
                        key={tag}
                        variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                        className="cursor-pointer transition-colors"
                        onClick={() => toggleTag(tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Execution Mode */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold">Execution Mode</h3>
                  <div className="space-y-2">
                    {executionModes.map((mode) => (
                      <label
                        key={mode}
                        className="flex cursor-pointer items-center gap-2"
                      >
                        <input
                          type="checkbox"
                          checked={selectedModes.includes(mode)}
                          onChange={() => toggleMode(mode)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span className="text-sm capitalize">{mode}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Price Range */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold">Price</h3>
                  <div className="space-y-2">
                    {priceRanges.map((range, index) => (
                      <label
                        key={index}
                        className="flex cursor-pointer items-center gap-2"
                      >
                        <input
                          type="radio"
                          checked={selectedPriceRange === index}
                          onChange={() => togglePriceRange(index)}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">{range.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Spells Grid */}
          <div className="flex-1">
            {/* Results Header */}
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {paginatedSpells.length} of {filteredSpells.length} spells
              </p>
            </div>

            {/* Grid */}
            {paginatedSpells.length > 0 ? (
              <>
                <div className="mb-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {paginatedSpells.map((spell) => (
                    <SpellCard key={spell.id} spell={spell} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                          key={page}
                          variant={currentPage === page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="h-8 w-8 p-0"
                        >
                          {page}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-lg border border-dashed p-12 text-center">
                <p className="mb-2 text-lg font-medium">No spells found</p>
                <p className="text-sm text-muted-foreground">
                  Try adjusting your filters or search query
                </p>
                <Button variant="outline" className="mt-4" onClick={clearFilters}>
                  Clear all filters
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
