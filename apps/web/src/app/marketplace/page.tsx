"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useDebounce } from "../../hooks/useDebounce";
import { usePlayerStore } from "@/store/playerStore";
import { FilterPanel } from "./components/FilterPanel";
import { SortDropdown } from "./components/SortDropdown";
import { TrackGrid } from "./components/TrackGrid";
import { TrackList } from "./components/TrackList";
import { FeaturedCarousel } from "./components/FeaturedCarousel";
import { Button } from "@mindscript/ui";
import { GridIcon, ListIcon } from "lucide-react";
import { FloatingOrbs } from "@/components/landing/FloatingOrbs";
import { GlassCard } from "@/components/ui/GlassCard";
import { MarketplaceHero } from "@/components/marketplace/MarketplaceHero";
import { MoodGrid } from "@/components/marketplace/MoodGrid";
import { cn } from "@/lib/utils";
import { Header } from "@/components/navigation/Header";
import { VoiceCloneCTA } from "@/components/builder/VoiceCloneCTA";
import { VoiceCloneShelf } from "@/components/builder/VoiceCloneShelf";
import type {
  MarketplaceCategory,
  MarketplaceSort,
  Publication,
  CategoryWithCount,
  FeaturedTracks,
} from "@mindscript/schemas";

type ViewMode = "grid" | "list";

interface Filters {
  search?: string;
  category?: MarketplaceCategory;
  categories?: MarketplaceCategory[];
  tags?: string[];
  priceRange?: { min?: number; max?: number };
  durationRange?: { min?: number; max?: number };
  sort: MarketplaceSort;
}

export default function MarketplacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentTrack, playerMode } = usePlayerStore();

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [tracks, setTracks] = useState<Publication[]>([]);
  const [featuredTracks, setFeaturedTracks] = useState<FeaturedTracks | null>(null);
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [filters, setFilters] = useState<Filters>({
    sort: "popular",
    search: searchParams.get("search") || undefined,
    category: searchParams.get("category") as MarketplaceCategory || undefined,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [hasClonedVoice, setHasClonedVoice] = useState(false);
  const [showCloneShelf, setShowCloneShelf] = useState(false);
  const [isFF, setIsFF] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>();

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(filters.search, 300);

  // Fetch user + voice clone check
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { getSupabaseBrowserClient } = await import("@mindscript/auth/client");
        const supabase = getSupabaseBrowserClient();
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        setUser(currentUser);

        if (currentUser) {
          try {
            const res = await fetch("/api/voices?includeCustom=true");
            if (res.ok) {
              const data = await res.json();
              setHasClonedVoice((data.voicesByTier?.custom?.length ?? 0) > 0);
            }
          } catch {
            // Non-critical
          }
          // Check F&F tier
          fetch("/api/pricing/check-eligibility")
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d?.ffTier) setIsFF(d.ffTier === 'inner_circle' || d.ffTier === 'cost_pass'); })
            .catch(() => {});
        }
      } catch {
        // Not authenticated
      }
    };
    checkUser();
  }, []);

  useEffect(() => {
    fetchFeaturedTracks();
    fetchCategories();
  }, []);

  useEffect(() => {
    setTracks([]);
    setCursor(undefined);
    setHasMore(true);
    fetchTracks(true);
  }, [debouncedSearch, filters.category, filters.categories, filters.tags, filters.priceRange, filters.durationRange, filters.sort]);

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          fetchTracks(false);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoadingMore, cursor]);

  const fetchFeaturedTracks = async () => {
    try {
      const response = await fetch("/api/marketplace/featured");
      if (!response.ok) throw new Error("Failed to fetch featured tracks");
      const data = await response.json();
      setFeaturedTracks(data);
    } catch (err) {
      console.error("Error fetching featured tracks:", err);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/marketplace/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      const data = await response.json();
      setCategories(data.categories);
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  const fetchTracks = async (reset: boolean = false) => {
    if (reset) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams();

      if (debouncedSearch) params.append("search", debouncedSearch);
      if (filters.category) params.append("category", filters.category);
      if (filters.categories) {
        filters.categories.forEach(cat => params.append("categories[]", cat));
      }
      if (filters.tags) {
        filters.tags.forEach(tag => params.append("tags[]", tag));
      }
      if (filters.priceRange?.min !== undefined) {
        params.append("priceRange[min]", filters.priceRange.min.toString());
      }
      if (filters.priceRange?.max !== undefined) {
        params.append("priceRange[max]", filters.priceRange.max.toString());
      }
      if (filters.durationRange?.min !== undefined) {
        params.append("durationRange[min]", filters.durationRange.min.toString());
      }
      if (filters.durationRange?.max !== undefined) {
        params.append("durationRange[max]", filters.durationRange.max.toString());
      }
      params.append("sort", filters.sort);

      if (!reset && cursor) {
        params.append("cursor", cursor);
      }

      const response = await fetch(`/api/marketplace/listings?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch tracks");

      const data = await response.json();

      if (reset) {
        setTracks(data.tracks);
      } else {
        setTracks(prev => [...prev, ...data.tracks]);
      }

      setHasMore(data.pagination.has_next);
      setCursor(data.pagination.cursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleFilterChange = useCallback((newFilters: Partial<Filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ sort: "popular" });
  }, []);

  const handleTrackClick = useCallback((trackId: string) => {
    router.push(`/marketplace/track/${trackId}`);
  }, [router]);

  const handleTagClick = useCallback((tag: string) => {
    handleFilterChange({ search: tag, category: tag as MarketplaceCategory });
  }, [handleFilterChange]);

  const hasActiveFilters = !!(
    filters.search ||
    filters.category ||
    filters.categories?.length ||
    filters.tags?.length ||
    filters.priceRange?.min !== undefined ||
    filters.priceRange?.max !== undefined ||
    filters.durationRange?.min !== undefined ||
    filters.durationRange?.max !== undefined
  );

  return (
    <div className={cn("min-h-screen bg-warm-gradient relative pt-16", currentTrack && playerMode === 'bar' && "pb-24")}>
      <Header variant="solid" />
      <FloatingOrbs variant="subtle" />

      {/* Hero Section */}
      <MarketplaceHero
        searchValue={filters.search || ""}
        onSearchChange={(search) => handleFilterChange({ search })}
        onTagClick={handleTagClick}
      />

      {/* Mood Grid */}
      <MoodGrid
        categories={categories}
        selectedCategory={filters.category}
        onCategorySelect={(category) => handleFilterChange({ category })}
      />

      {/* Featured Section (only show if no filters active) */}
      {!hasActiveFilters && featuredTracks && (
        <section className="container mx-auto px-4 py-8 relative z-10">
          <FeaturedCarousel tracks={featuredTracks} onTrackClick={handleTrackClick} />
        </section>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Header Bar */}
        <GlassCard hover="none" noPadding className="p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <SortDropdown
                value={filters.sort}
                onChange={(sort) => handleFilterChange({ sort })}
              />
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="text-primary"
                >
                  Clear filters
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                className={viewMode !== "grid" ? "glass" : ""}
              >
                <GridIcon className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
                aria-label="List view"
                className={viewMode !== "list" ? "glass" : ""}
              >
                <ListIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </GlassCard>

        {/* Voice Clone CTA */}
        {user && (
          <VoiceCloneCTA
            variant="inline"
            hasClonedVoice={hasClonedVoice}
            isFF={isFF}
            onClick={() => setShowCloneShelf(true)}
            className="mb-6"
          />
        )}

        <div className="flex gap-8">
          {/* Filter Panel */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <GlassCard hover="none" className="sticky top-8">
              <FilterPanel
                filters={filters}
                onFilterChange={handleFilterChange}
                onClearFilters={handleClearFilters}
                categories={categories}
              />
            </GlassCard>
          </aside>

          {/* Track Listings */}
          <main className="flex-1">
            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <GlassCard className="text-center">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <p className="text-muted">Loading tracks...</p>
                </GlassCard>
              </div>
            )}

            {/* Error State */}
            {error && (
              <GlassCard className="border-error/20 mb-6">
                <p className="text-error mb-2">Error: {error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchTracks(true)}
                >
                  Try again
                </Button>
              </GlassCard>
            )}

            {/* Tracks */}
            {!isLoading && !error && (
              <>
                <div data-testid="track-container" className={viewMode}>
                  {viewMode === "grid" ? (
                    <TrackGrid tracks={tracks} onTrackClick={handleTrackClick} />
                  ) : (
                    <TrackList tracks={tracks} onTrackClick={handleTrackClick} />
                  )}
                </div>

                {/* Empty State */}
                {tracks.length === 0 && (
                  <GlassCard className="text-center py-12">
                    <p className="text-muted mb-4">
                      No tracks found matching your criteria
                    </p>
                    {hasActiveFilters && (
                      <Button variant="outline" onClick={handleClearFilters} className="glass">
                        Clear filters
                      </Button>
                    )}
                  </GlassCard>
                )}

                {/* Load More Trigger */}
                {hasMore && (
                  <div ref={loadMoreRef} className="py-8 text-center">
                    {isLoadingMore && (
                      <div className="w-8 h-8 mx-auto rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    )}
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* Voice Clone Shelf */}
      <VoiceCloneShelf
        isOpen={showCloneShelf}
        onClose={() => setShowCloneShelf(false)}
        onComplete={() => {
          setShowCloneShelf(false);
          window.location.reload();
        }}
      />
    </div>
  );
}
