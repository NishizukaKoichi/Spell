'use client';

import { useState, useMemo } from 'react';
import { SpellCard } from '@/components/spell-card';
import { SearchBar } from '@/components/search-bar';
import { CategoryFilter } from '@/components/category-filter';
import { SortSelect } from '@/components/sort-select';
import { Spell } from '@/types/spell';

interface MySpellsClientProps {
  spells: Spell[];
}

export function MySpellsClient({ spells }: MySpellsClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');

  const filteredAndSortedSpells = useMemo(() => {
    let filtered = spells;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (spell) =>
          spell.name.toLowerCase().includes(query) ||
          spell.description.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (category !== 'all') {
      filtered = filtered.filter((spell) => spell.category === category);
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        case 'casts':
          return (b._count?.casts || 0) - (a._count?.casts || 0);
        case 'createdAt':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  }, [spells, searchQuery, category, sortBy]);

  return (
    <div className="space-y-6">
      {/* Search and filters */}
      <div className="flex gap-4">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search your spells..."
        />
        <CategoryFilter value={category} onChange={setCategory} />
        <SortSelect value={sortBy} onChange={setSortBy} />
      </div>

      {/* Results count */}
      {searchQuery || category !== 'all' ? (
        <div className="text-sm text-white/60">
          Found {filteredAndSortedSpells.length} spell
          {filteredAndSortedSpells.length !== 1 ? 's' : ''}
        </div>
      ) : null}

      {/* Spell grid */}
      {filteredAndSortedSpells.length === 0 ? (
        <div className="text-center py-12 text-white/60">
          No spells found matching your criteria
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedSpells.map((spell) => (
            <SpellCard key={spell.id} spell={spell} />
          ))}
        </div>
      )}
    </div>
  );
}
