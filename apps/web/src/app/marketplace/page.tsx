"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useDebounce } from "@/hooks/useDebounce";
import { SearchBar } from "./components/SearchBar";
import { FilterPanel } from "./components/FilterPanel";
import { CategoryNav } from "./components/CategoryNav";
import { SortDropdown } from "./components/SortDropdown";
import { TrackGrid } from "./components/TrackGrid";
import { TrackList } from "./components/TrackList";
import { FeaturedCarousel } from "./components/FeaturedCarousel";
import { Button } from "@mindscript/ui";
import { GridIcon, ListIcon } from "lucide-react";
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
  
  // State
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
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>();
  
  // Refs
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  // Debounced search
  const debouncedSearch = useDebounce(filters.search, 300);
  
  // Load featured tracks
  useEffect(() => {
    fetchFeaturedTracks();
    fetchCategories();
  }, []);
  
  // Load tracks when filters change
  useEffect(() => {
    setTracks([]);
    setCursor(undefined);
    setHasMore(true);
    fetchTracks(true);
  }, [debouncedSearch, filters.category, filters.categories, filters.tags, filters.priceRange, filters.durationRange, filters.sort]);
  
  // Set up infinite scroll
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
  
  // Fetch featured tracks
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
  
  // Fetch categories
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
  
  // Fetch tracks
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
  
  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: Partial<Filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);
  
  // Clear filters
  const handleClearFilters = useCallback(() => {
    setFilters({ sort: "popular" });
  }, []);
  
  // Handle track click
  const handleTrackClick = useCallback((trackId: string) => {
    router.push(`/marketplace/track/${trackId}`);
  }, [router]);
  
  // Check if any filters are active
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold">Marketplace</h1>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
              >
                <GridIcon className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
                aria-label="List view"
              >
                <ListIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Search and Sort */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <SearchBar
                value={filters.search || ""}
                onChange={(search) => handleFilterChange({ search })}
                placeholder="Search tracks..."
              />
            </div>
            <SortDropdown
              value={filters.sort}
              onChange={(sort) => handleFilterChange({ sort })}
            />
          </div>
        </div>
      </div>
      
      {/* Category Navigation */}
      <CategoryNav
        categories={categories}
        selectedCategory={filters.category}
        onCategorySelect={(category) => handleFilterChange({ category })}
      />
      
      {/* Featured Section (only show if no filters active) */}
      {!hasActiveFilters && featuredTracks && (
        <div className="container mx-auto px-4 py-8">
          <FeaturedCarousel tracks={featuredTracks} onTrackClick={handleTrackClick} />
        </div>
      )}
      
      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Filter Panel */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <FilterPanel
              filters={filters}
              onFilterChange={handleFilterChange}
              onClearFilters={handleClearFilters}
              categories={categories}
            />
          </aside>
          
          {/* Track Listings */}
          <main className="flex-1">
            {/* Active Filters Bar */}
            {hasActiveFilters && (
              <div className="mb-4 p-3 bg-muted rounded-lg flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Filters active
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                >
                  Clear filters
                </Button>
              </div>
            )}
            
            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading tracks...</p>
                </div>
              </div>
            )}
            
            {/* Error State */}
            {error && (
              <div className="p-6 bg-destructive/10 border border-destructive rounded-lg">
                <p className="text-destructive">Error: {error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchTracks(true)}
                  className="mt-2"
                >
                  Try again
                </Button>
              </div>
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
                  <div className="text-center py-12">
                    <p className="text-muted-foreground mb-4">
                      No tracks found matching your criteria
                    </p>
                    {hasActiveFilters && (
                      <Button variant="outline" onClick={handleClearFilters}>
                        Clear filters
                      </Button>
                    )}
                  </div>
                )}
                
                {/* Load More Trigger */}
                {hasMore && (
                  <div ref={loadMoreRef} className="py-8 text-center">
                    {isLoadingMore && (
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    )}
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}