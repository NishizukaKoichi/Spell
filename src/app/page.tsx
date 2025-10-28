"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { SpellCard } from "@/components/spell-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spell } from "@/types/spell";
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface FiltersData {
  categories: string[];
  tags: string[];
}

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [spells, setSpells] = useState<Spell[]>([]);
  const [filters, setFilters] = useState<FiltersData>({
    categories: [],
    tags: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState(
    searchParams.get("search") || ""
  );
  const [selectedCategory, setSelectedCategory] = useState(
    searchParams.get("category") || "all"
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(
    searchParams.get("tags")?.split(",").filter(Boolean) || []
  );
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") || "");
  const [priceModel, setPriceModel] = useState(
    searchParams.get("priceModel") || "all"
  );
  const [sortBy, setSortBy] = useState(
    searchParams.get("sortBy") || "popularity"
  );

  const fetchSpells = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (selectedCategory !== "all")
        params.set("category", selectedCategory);
      if (selectedTags.length > 0) params.set("tags", selectedTags.join(","));
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      if (priceModel !== "all") params.set("priceModel", priceModel);
      params.set("sortBy", sortBy);

      const response = await fetch(`/api/spells?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setSpells(data.spells);
        if (data.filters) {
          setFilters(data.filters);
        }
      }
    } catch (error) {
      console.error("Failed to fetch spells:", error);
    } finally {
      setIsLoading(false);
    }
  }, [
    searchQuery,
    selectedCategory,
    selectedTags,
    minPrice,
    maxPrice,
    priceModel,
    sortBy,
  ]);

  useEffect(() => {
    fetchSpells();
  }, [fetchSpells]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (selectedCategory !== "all") params.set("category", selectedCategory);
    if (selectedTags.length > 0) params.set("tags", selectedTags.join(","));
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (priceModel !== "all") params.set("priceModel", priceModel);
    if (sortBy !== "popularity") params.set("sortBy", sortBy);

    const queryString = params.toString();
    router.push(queryString ? `/?${queryString}` : "/", { scroll: false });
  }, [
    searchQuery,
    selectedCategory,
    selectedTags,
    minPrice,
    maxPrice,
    priceModel,
    sortBy,
    router,
  ]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedTags([]);
    setMinPrice("");
    setMaxPrice("");
    setPriceModel("all");
    setSortBy("popularity");
  };

  const hasActiveFilters =
    searchQuery ||
    selectedCategory !== "all" ||
    selectedTags.length > 0 ||
    minPrice ||
    maxPrice ||
    priceModel !== "all" ||
    sortBy !== "popularity";

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Spell Marketplace</h1>
          <p className="text-white/60">
            Discover and cast powerful spells for your workflows
          </p>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input
              placeholder="Search spells..."
              className="pl-10 bg-white/5 border-white/10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Filters
            {showFilters ? (
              <ChevronUp className="h-4 w-4 ml-2" />
            ) : (
              <ChevronDown className="h-4 w-4 ml-2" />
            )}
          </Button>
        </div>

        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-white/60">Active filters:</span>
            {selectedCategory !== "all" && (
              <Badge
                variant="outline"
                className="cursor-pointer"
                onClick={() => setSelectedCategory("all")}
              >
                {selectedCategory}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            )}
            {selectedTags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="cursor-pointer"
                onClick={() => handleTagToggle(tag)}
              >
                {tag}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            ))}
            {priceModel !== "all" && (
              <Badge
                variant="outline"
                className="cursor-pointer"
                onClick={() => setPriceModel("all")}
              >
                {priceModel === "one_time" ? "One-time" : "Metered"}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            )}
            {(minPrice || maxPrice) && (
              <Badge
                variant="outline"
                className="cursor-pointer"
                onClick={() => {
                  setMinPrice("");
                  setMaxPrice("");
                }}
              >
                ${minPrice || "0"} - ${maxPrice || "∞"}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-xs"
            >
              Clear all
            </Button>
          </div>
        )}

        {/* Filter Panel */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6 bg-white/5 rounded-lg border border-white/10">
            {/* Category Filter */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Category</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="category"
                    checked={selectedCategory === "all"}
                    onChange={() => setSelectedCategory("all")}
                    className="accent-purple-500"
                  />
                  <span className="text-sm">All Categories</span>
                </label>
                {filters.categories.map((cat) => (
                  <label
                    key={cat}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="category"
                      checked={selectedCategory === cat}
                      onChange={() => setSelectedCategory(cat)}
                      className="accent-purple-500"
                    />
                    <span className="text-sm">{cat}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price Filter */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Price Range</h3>
              <div className="space-y-2">
                <Input
                  type="number"
                  placeholder="Min ($)"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="bg-white/5 border-white/10"
                />
                <Input
                  type="number"
                  placeholder="Max ($)"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="bg-white/5 border-white/10"
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="priceModel"
                    checked={priceModel === "all"}
                    onChange={() => setPriceModel("all")}
                    className="accent-purple-500"
                  />
                  <span className="text-sm">All Models</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="priceModel"
                    checked={priceModel === "one_time"}
                    onChange={() => setPriceModel("one_time")}
                    className="accent-purple-500"
                  />
                  <span className="text-sm">One-time</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="priceModel"
                    checked={priceModel === "metered"}
                    onChange={() => setPriceModel("metered")}
                    className="accent-purple-500"
                  />
                  <span className="text-sm">Metered</span>
                </label>
              </div>
            </div>

            {/* Tags Filter */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Tags</h3>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                {filters.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={
                      selectedTags.includes(tag) ? "default" : "outline"
                    }
                    className="cursor-pointer"
                    onClick={() => handleTagToggle(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Sort Options */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Sort By</h3>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm"
              >
                <option value="popularity">Most Popular</option>
                <option value="rating">Highest Rated</option>
                <option value="newest">Newest</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="name">Name A-Z</option>
              </select>
            </div>
          </div>
        )}

        {/* Results */}
        {isLoading ? (
          <div className="text-center py-12 text-white/60">
            Loading spells...
          </div>
        ) : spells.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/60 mb-4">No spells found</p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="text-sm text-white/60">
              Found {spells.length} spell{spells.length !== 1 ? "s" : ""}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {spells.map((spell) => (
                <SpellCard key={spell.id} spell={spell} />
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
