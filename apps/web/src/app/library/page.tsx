"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useDebounce } from "@/hooks/useDebounce";
import { usePlayerStore } from "@/store/playerStore";
import { Button, Input, Spinner } from "@mindscript/ui";
import {
  GridIcon,
  ListIcon,
  FilterIcon,
  SearchIcon,
  XIcon,
  LogOutIcon,
  UserIcon,
  PlusIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FloatingOrbs } from "@/components/landing/FloatingOrbs";
import { GlassCard } from "@/components/ui/GlassCard";
import { GradientButton } from "@/components/ui/GradientButton";
import { LibraryTrackCard } from "@/components/library/LibraryTrackCard";
import { LibraryEmptyState } from "@/components/library/LibraryEmptyState";
import { RenderProgressBanner } from "@/components/library/RenderProgressBanner";
import { Header } from "@/components/navigation/Header";
import { VoiceCloneCTA } from "@/components/builder/VoiceCloneCTA";
import { VoiceCloneShelf } from "@/components/builder/VoiceCloneShelf";

type ViewMode = "grid" | "list";
type OwnershipFilter = "all" | "owned" | "purchased";
type StatusFilter = "all" | "draft" | "rendering" | "published" | "failed";
type SortBy = "created_at" | "title" | "last_played" | "duration";
type SortOrder = "asc" | "desc";

interface Track {
  id: string;
  title: string;
  description?: string;
  duration: number;
  tags?: string[];
  status: "draft" | "rendering" | "published" | "failed";
  cover_image_url?: string;
  audio_url?: string;
  audio_signed_url?: string;
  created_at: string;
  updated_at: string;
  ownership: "owned" | "purchased";
  purchasedAt?: string;
  profiles?: {
    display_name: string;
    avatar_url?: string;
  };
  renderStatus?: {
    id: string;
    status: string;
    progress: number;
    createdAt: string;
    updatedAt: string;
  };
}

interface Filters {
  search: string;
  ownership: OwnershipFilter;
  status: StatusFilter;
  tags: string[];
  durationRange?: { min?: number; max?: number };
  sort: SortBy;
  order: SortOrder;
}

export default function LibraryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { currentTrack, isPlaying, playerMode, setQueue, playTrackAtIndex, togglePlayPause } = usePlayerStore();

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showCloneShelf, setShowCloneShelf] = useState(false);
  const [hasClonedVoice, setHasClonedVoice] = useState(false);
  const [isFF, setIsFF] = useState(false);

  const [filters, setFilters] = useState<Filters>({
    search: searchParams.get("search") || "",
    ownership: (searchParams.get("ownership") as OwnershipFilter) || "all",
    status: (searchParams.get("status") as StatusFilter) || "all",
    tags: searchParams.get("tags")?.split(",").filter(Boolean) || [],
    sort: (searchParams.get("sort") as SortBy) || "created_at",
    order: (searchParams.get("order") as SortOrder) || "desc",
  });

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTracks, setTotalTracks] = useState(0);

  const debouncedSearch = useDebounce(filters.search, 300);

  // New track or edit re-render state
  const isNewTrack = searchParams.get("new") === "true";
  const isEditedTrack = searchParams.get("edited") === "true";
  const isAwaitingRender = isNewTrack || isEditedTrack;
  const sessionId = searchParams.get("session");
  const [newTrackStatus, setNewTrackStatus] = useState<"creating" | "rendering" | "complete" | null>(
    isAwaitingRender ? "creating" : null
  );
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);

  // Core fetch — silent flag skips loading UI (used by polling/realtime)
  const fetchTracks = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) {
      setIsLoading(true);
      setError(null);
    }

    try {
      const params = new URLSearchParams();
      params.append("ownership", filters.ownership);
      params.append("status", filters.status);
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (filters.tags.length > 0) params.append("tags", filters.tags.join(","));
      params.append("sort", filters.sort);
      params.append("order", filters.order);
      params.append("page", page.toString());
      params.append("limit", "20");
      params.append("includeRenderStatus", "true");

      const response = await fetch(`/api/library/tracks?${params.toString()}`);

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/auth/login?redirectTo=/library");
          return null;
        }
        throw new Error("Failed to fetch tracks");
      }

      const data = await response.json();
      setTracks(data.tracks);
      setTotalPages(data.pagination.totalPages);
      setTotalTracks(data.pagination.total);
      return data.tracks as Track[];
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : "An error occurred");
      return null;
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [filters.ownership, filters.status, filters.sort, filters.order, filters.tags, debouncedSearch, page, router]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  // Fetch user info and check for cloned voices
  useEffect(() => {
    const fetchUser = async () => {
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
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    fetchUser();
  }, []);

  // Poll for new track / edit completion — silently refreshes in background
  useEffect(() => {
    if (!isAwaitingRender) return;

    let pollInterval: NodeJS.Timeout;
    let pollCount = 0;
    const maxPolls = 60;

    const pollForTrack = async () => {
      try {
        const latestTracks = await fetchTracks({ silent: true });
        if (!latestTracks) return;

        const newTrack = latestTracks.find(
          (t) => t.status === "rendering" || t.status === "draft" || t.status === "published"
        );

        if (newTrack) {
          const isComplete = newTrack.audio_url || newTrack.status === "published";

          if (isComplete && newTrackStatus !== "complete") {
            setNewTrackStatus("complete");
            setShowSuccessNotification(true);
            clearInterval(pollInterval);

            setTimeout(() => setShowSuccessNotification(false), 5000);
            setTimeout(() => {
              const url = new URL(window.location.href);
              url.searchParams.delete("new");
              url.searchParams.delete("edited");
              url.searchParams.delete("session");
              window.history.replaceState({}, "", url.toString());
            }, 6000);
          } else if (newTrack.status === "rendering" && newTrackStatus === "creating") {
            setNewTrackStatus("rendering");
          } else if (newTrack.status === "draft" && newTrackStatus === "creating") {
            setNewTrackStatus("rendering");
          }
        }

        pollCount++;
        if (pollCount >= maxPolls) {
          setNewTrackStatus("complete");
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error("Error polling for track:", error);
      }
    };

    const initialTimeout = setTimeout(pollForTrack, 2000);
    pollInterval = setInterval(pollForTrack, 5000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(pollInterval);
    };
  }, [isAwaitingRender, fetchTracks, newTrackStatus]);

  // Realtime subscription — listen for job updates, refresh silently
  useEffect(() => {
    if (!isAwaitingRender) return;

    let cleanup: (() => void) | undefined;

    const setupRealtime = async () => {
      const { getSupabaseBrowserClient } = await import("@mindscript/auth/client");
      const supabase = getSupabaseBrowserClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const subscription = supabase
        .channel("audio_jobs")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "audio_job_queue",
            filter: `user_id=eq.${user.id}`,
          },
          () => fetchTracks({ silent: true })
        )
        .subscribe();

      cleanup = () => { subscription.unsubscribe(); };
    };

    setupRealtime();

    return () => { cleanup?.(); };
  }, [isAwaitingRender, fetchTracks]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      const { getSupabaseBrowserClient } = await import("@mindscript/auth/client");
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut().catch(() => {});
      if (typeof window !== "undefined") {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes("supabase") || key.includes("auth"))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
        sessionStorage.clear();
      }
      router.push("/");
    } catch {
      router.push("/");
    }
  };

  const handleFilterChange = useCallback((updates: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: "",
      ownership: "all",
      status: "all",
      tags: [],
      sort: "created_at",
      order: "desc",
    });
  }, []);

  const handlePlayTrack = useCallback(
    (track: Track, index: number) => {
      const audioUrl = track.audio_signed_url || track.audio_url;
      if (!audioUrl) return;

      const playerTracks = tracks
        .filter((t) => t.audio_signed_url || t.audio_url)
        .map((t) => ({
          id: t.id,
          title: t.title,
          artist: t.profiles?.display_name,
          url: t.audio_signed_url || t.audio_url!,
          duration: t.duration,
          coverImage: t.cover_image_url,
          type: t.ownership as "owned" | "purchased",
          status: t.status,
        }));

      const actualIndex = playerTracks.findIndex((t) => t.id === track.id);

      if (currentTrack?.id === track.id) {
        togglePlayPause();
      } else {
        setQueue(playerTracks, actualIndex);
        playTrackAtIndex(actualIndex);
      }
    },
    [tracks, currentTrack, setQueue, playTrackAtIndex, togglePlayPause]
  );

  const handleDownloadTrack = useCallback(async (track: Track) => {
    try {
      const response = await fetch(`/api/tracks/${track.id}/stream`);
      if (!response.ok) return;

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${track.title.replace(/[^a-z0-9\s\-_]/gi, "")}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    }
  }, []);

  const handleEditTrack = useCallback(
    (trackId: string) => {
      router.push(`/library/${trackId}/edit`);
    },
    [router]
  );

  const hasActiveFilters = useMemo(() => {
    return !!(
      filters.search ||
      filters.ownership !== "all" ||
      filters.status !== "all" ||
      filters.tags.length > 0
    );
  }, [filters]);

  return (
    <div className={cn("min-h-screen bg-warm-gradient relative", currentTrack && playerMode === 'bar' && "pb-24")}>
      <Header variant="solid" />
      <FloatingOrbs variant="subtle" />

      {/* Hero Header */}
      <div className="relative z-10 pt-16">
        <section className="relative py-12 md:py-16 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-soft-lavender/40 via-warm-cream/30 to-calm-mint/40" />

          <div className="container mx-auto px-4 relative z-10">
            {/* User info bar */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <UserIcon className="h-5 w-5 text-white" />
                </div>
                {user && (
                  <div>
                    <p className="text-sm font-medium">{user.email}</p>
                    <p className="text-xs text-muted">Signed in</p>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="glass"
              >
                {isLoggingOut ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    Logging out...
                  </>
                ) : (
                  <>
                    <LogOutIcon className="h-4 w-4 mr-2" />
                    Logout
                  </>
                )}
              </Button>
            </div>

            {/* Hero content */}
            <div className="text-center mb-8">
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                <span className="text-gradient-static">Your Library</span>
              </h1>
              <p className="text-muted text-lg">
                {totalTracks} {totalTracks === 1 ? "track" : "tracks"} in your collection
              </p>
            </div>

            {/* Search bar */}
            <div className="max-w-xl mx-auto mb-8">
              <GlassCard hover="none" className="flex items-center gap-3 px-4 py-3">
                <SearchIcon className="h-5 w-5 text-muted flex-shrink-0" />
                <Input
                  type="text"
                  placeholder="Search your library..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange({ search: e.target.value })}
                  className="border-0 bg-transparent focus:ring-0 p-0"
                />
              </GlassCard>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <GradientButton
                variant="primary"
                size="sm"
                glow
                onClick={() => router.push("/builder")}
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                New Track
              </GradientButton>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={showFilters ? "bg-primary/10" : "glass"}
              >
                <FilterIcon className="h-4 w-4 mr-2" />
                Filters
              </Button>
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
        </section>

        {/* New Track Banner */}
        {isAwaitingRender && newTrackStatus && newTrackStatus !== "complete" && (
          <div className="container mx-auto px-4 py-4">
            <RenderProgressBanner
              status={newTrackStatus}
              onDismiss={() => setNewTrackStatus("complete")}
            />
          </div>
        )}

        {/* Success Notification */}
        {showSuccessNotification && (
          <div className="container mx-auto px-4 py-4">
            <RenderProgressBanner status="complete" onDismiss={() => setShowSuccessNotification(false)} />
          </div>
        )}

        {/* Filters Panel */}
        {showFilters && (
          <GlassCard hover="none" noPadding className="rounded-none border-x-0">
            <div className="container mx-auto px-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Ownership Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Ownership</label>
                  <select
                    value={filters.ownership}
                    onChange={(e) => handleFilterChange({ ownership: e.target.value as OwnershipFilter })}
                    className="w-full px-3 py-2 rounded-lg glass border border-white/20 bg-transparent"
                  >
                    <option value="all">All Tracks</option>
                    <option value="owned">Created by Me</option>
                    <option value="purchased">Purchased</option>
                  </select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange({ status: e.target.value as StatusFilter })}
                    className="w-full px-3 py-2 rounded-lg glass border border-white/20 bg-transparent"
                  >
                    <option value="all">All Status</option>
                    <option value="published">Published</option>
                    <option value="rendering">Rendering</option>
                    <option value="draft">Draft</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                {/* Sort By */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Sort By</label>
                  <select
                    value={filters.sort}
                    onChange={(e) => handleFilterChange({ sort: e.target.value as SortBy })}
                    className="w-full px-3 py-2 rounded-lg glass border border-white/20 bg-transparent"
                  >
                    <option value="created_at">Date Added</option>
                    <option value="title">Title</option>
                    <option value="duration">Duration</option>
                    <option value="last_played">Last Played</option>
                  </select>
                </div>

                {/* Sort Order */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Order</label>
                  <select
                    value={filters.order}
                    onChange={(e) => handleFilterChange({ order: e.target.value as SortOrder })}
                    className="w-full px-3 py-2 rounded-lg glass border border-white/20 bg-transparent"
                  >
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                </div>
              </div>

              {hasActiveFilters && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                  <span className="text-sm text-muted">Active filters applied</span>
                  <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                    <XIcon className="h-4 w-4 mr-2" />
                    Clear all filters
                  </Button>
                </div>
              )}
            </div>
          </GlassCard>
        )}
      </div>

      {/* Voice Clone CTA */}
      {user && (
        <div className="container mx-auto px-4 pt-4 relative z-10">
          <VoiceCloneCTA
            variant="inline"
            hasClonedVoice={hasClonedVoice}
            isFF={isFF}
            onClick={() => setShowCloneShelf(true)}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Loading State — only show full spinner on initial load when we have no tracks yet */}
        {isLoading && tracks.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <GlassCard className="text-center">
              <Spinner className="h-12 w-12 mx-auto mb-4 text-primary" />
              <p className="text-muted">Loading your tracks...</p>
            </GlassCard>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <GlassCard className="border-error/20">
            <p className="text-error mb-2">Error: {error}</p>
            <Button variant="outline" size="sm" onClick={fetchTracks}>
              Try again
            </Button>
          </GlassCard>
        )}

        {/* Tracks Grid/List — always show if we have tracks (no flash on refetch) */}
        {!error && tracks.length > 0 && (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
                : "space-y-4"
            }
          >
            {tracks.map((track, index) => (
              <LibraryTrackCard
                key={track.id}
                track={track}
                viewMode={viewMode}
                isCurrentTrack={currentTrack?.id === track.id}
                isPlaying={isPlaying}
                onPlay={() => handlePlayTrack(track, index)}
                onDownload={() => handleDownloadTrack(track)}
                onEdit={() => handleEditTrack(track.id)}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && tracks.length === 0 && (
          <LibraryEmptyState
            hasActiveFilters={hasActiveFilters}
            onClearFilters={handleClearFilters}
            onCreateTrack={() => router.push("/builder")}
            onBrowseMarketplace={() => router.push("/marketplace")}
          />
        )}

        {/* Pagination */}
        {!isLoading && !error && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="glass"
            >
              Previous
            </Button>
            <GlassCard hover="none" noPadding className="px-4 py-2">
              <span className="text-sm text-muted">
                Page {page} of {totalPages}
              </span>
            </GlassCard>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="glass"
            >
              Next
            </Button>
          </div>
        )}
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
