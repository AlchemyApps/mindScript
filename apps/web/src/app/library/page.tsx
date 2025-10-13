"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useDebounce } from "@/hooks/useDebounce";
import { usePlayerStore } from "@/store/playerStore";
import { Button, Card, CardContent, CardHeader, Badge, Input, Spinner } from "@mindscript/ui";
import {
  GridIcon,
  ListIcon,
  PlayIcon,
  PauseIcon,
  DownloadIcon,
  EditIcon,
  FilterIcon,
  SearchIcon,
  MusicIcon,
  ClockIcon,
  TagIcon,
  XIcon,
  FolderOpenIcon,
  LogOutIcon,
  UserIcon,
  PlusIcon
} from "lucide-react";
import { formatDuration } from "@mindscript/schemas";

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

  // Player store
  const {
    currentTrack,
    isPlaying,
    setQueue,
    playTrackAtIndex,
    togglePlayPause
  } = usePlayerStore();

  // State
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
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
  
  // Debounced search
  const debouncedSearch = useDebounce(filters.search, 300);
  
  // Fetch tracks
  const fetchTracks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

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
          return;
        }
        throw new Error("Failed to fetch tracks");
      }
      
      const data = await response.json();
      setTracks(data.tracks);
      setTotalPages(data.pagination.totalPages);
      setTotalTracks(data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [filters.ownership, filters.status, filters.sort, filters.order, filters.tags, debouncedSearch, page, router]);
  
  // Fetch tracks on filter change
  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  // Fetch user info on mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { getSupabaseBrowserClient } = await import('@mindscript/auth/client');
        const supabase = getSupabaseBrowserClient();
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };
    fetchUser();
  }, []);

  // Handle logout
  const handleLogout = async () => {
    console.log('Starting logout process...');
    setIsLoggingOut(true);

    try {
      // First try server-side logout (more reliable)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      try {
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error('Server logout failed with status:', response.status);
        } else {
          console.log('Server logout successful');
        }
      } catch (fetchError: any) {
        if (fetchError.name === 'AbortError') {
          console.error('Logout request timed out after 5 seconds');
        } else {
          console.error('Server logout error:', fetchError);
        }
      }

      // Also try client-side cleanup (with timeout)
      try {
        const { getSupabaseBrowserClient } = await import('@mindscript/auth/client');
        const supabase = getSupabaseBrowserClient();

        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Client logout timeout')), 2000);
        });

        // Race the signOut against the timeout
        await Promise.race([
          supabase.auth.signOut(),
          timeoutPromise
        ]).catch(err => {
          console.log('Client logout failed or timed out:', err.message);
        });
      } catch (clientError) {
        console.log('Client logout error (non-critical):', clientError);
      }

      // Clear any local storage
      if (typeof window !== 'undefined') {
        try {
          // Clear auth-related items from localStorage
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('supabase') || key.includes('auth'))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));

          // Also clear session storage
          sessionStorage.clear();
        } catch (e) {
          console.log('Storage cleanup error (non-critical):', e);
        }
      }

      // Always redirect regardless of any errors
      console.log('Redirecting to home page...');
      router.push('/');

    } catch (error) {
      console.error('Unexpected logout error:', error);
      // Still redirect even if everything fails
      router.push('/');
    } finally {
      // Don't set isLoggingOut to false since we're navigating away
      // This prevents the button from flickering back
    }
  };

  // Detect new track from URL
  const isNewTrack = searchParams.get('new') === 'true';
  const sessionId = searchParams.get('session');
  const [newTrackStatus, setNewTrackStatus] = useState<'creating' | 'rendering' | 'complete' | null>(isNewTrack ? 'creating' : null);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);

  // Poll for new track completion
  useEffect(() => {
    if (!isNewTrack || !sessionId) return;

    let pollInterval: NodeJS.Timeout;
    let pollCount = 0;
    const maxPolls = 60; // Poll for up to 5 minutes (5s intervals)

    const pollForTrack = async () => {
      try {
        // Check if tracks list has a new track (any status)
        const newTrack = tracks.find(t =>
          t.status === 'rendering' ||
          t.status === 'draft' ||
          t.status === 'published'
        );

        if (newTrack) {
          // Check if rendering is complete (has audio_url or status is published)
          const isComplete = newTrack.audio_url || newTrack.status === 'published';

          if (isComplete && newTrackStatus !== 'complete') {
            // Track is complete!
            setNewTrackStatus('complete');
            setShowSuccessNotification(true);
            clearInterval(pollInterval);

            // Hide notification after 5 seconds
            setTimeout(() => setShowSuccessNotification(false), 5000);

            // Clear URL params after showing notification
            setTimeout(() => {
              const url = new URL(window.location.href);
              url.searchParams.delete('new');
              url.searchParams.delete('session');
              window.history.replaceState({}, '', url.toString());
            }, 6000);
          } else if (newTrack.status === 'rendering' && newTrackStatus === 'creating') {
            // Track record exists and is rendering
            setNewTrackStatus('rendering');
          } else if (newTrack.status === 'draft' && newTrackStatus === 'creating') {
            // Track created, waiting for render to start
            setNewTrackStatus('rendering');
          }
        }

        pollCount++;
        if (pollCount >= maxPolls) {
          // Timeout - auto-dismiss banner
          setNewTrackStatus('complete');
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Error polling for track:', error);
      }
    };

    // Initial poll after 2 seconds
    const initialTimeout = setTimeout(pollForTrack, 2000);

    // Then poll every 5 seconds
    pollInterval = setInterval(pollForTrack, 5000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(pollInterval);
    };
  }, [isNewTrack, sessionId, tracks, newTrackStatus]);

  // Set up Supabase Realtime subscription for rendering tracks
  useEffect(() => {
    if (!isNewTrack) return;

    const setupRealtime = async () => {
      const { getSupabaseBrowserClient } = await import('@mindscript/auth/client');
      const supabase = getSupabaseBrowserClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const subscription = supabase
        .channel('audio_jobs')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'audio_job_queue',
          filter: `user_id=eq.${user.id}`,
        }, (payload) => {
          // Update track status in UI when job completes
          fetchTracks();
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    };

    setupRealtime();
  }, [isNewTrack, fetchTracks]);
  
  // Handle filter changes
  const handleFilterChange = useCallback((updates: Partial<Filters>) => {
    setFilters(prev => ({ ...prev, ...updates }));
  }, []);
  
  // Clear all filters
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
  
  // Handle track play
  const handlePlayTrack = useCallback((track: Track, index: number) => {
    // Check for signed URL first, then regular URL
    const audioUrl = (track as any).audio_signed_url || track.audio_url;
    if (!audioUrl) return;

    // Convert tracks to player format - include all tracks with audio_url
    const playerTracks = tracks
      .filter(t => {
        const url = (t as any).audio_signed_url || t.audio_url;
        return !!url; // Include any track with audio
      })
      .map(t => ({
        id: t.id,
        title: t.title,
        artist: t.profiles?.display_name,
        url: (t as any).audio_signed_url || t.audio_url!,
        duration: t.duration,
        coverImage: t.cover_image_url,
        type: t.ownership as "owned" | "purchased",
        status: t.status,
      }));
    
    // Find the actual index in the filtered list
    const actualIndex = playerTracks.findIndex(t => t.id === track.id);
    
    if (currentTrack?.id === track.id) {
      togglePlayPause();
    } else {
      setQueue(playerTracks, actualIndex);
      playTrackAtIndex(actualIndex);
    }
  }, [tracks, currentTrack, setQueue, playTrackAtIndex, togglePlayPause]);
  
  // Handle track download
  const handleDownloadTrack = useCallback(async (track: Track) => {
    try {
      // Use the streaming endpoint that returns the file directly
      const response = await fetch(`/api/tracks/${track.id}/stream`);

      if (!response.ok) {
        const error = await response.json();
        console.error("Download error:", error);
        return;
      }

      // The response is the actual file with proper headers
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${track.title.replace(/[^a-z0-9\s\-_]/gi, '')}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    }
  }, []);
  
  // Handle track edit
  const handleEditTrack = useCallback((trackId: string) => {
    router.push(`/builder/${trackId}`);
  }, [router]);
  
  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return !!(
      filters.search ||
      filters.ownership !== "all" ||
      filters.status !== "all" ||
      filters.tags.length > 0
    );
  }, [filters]);
  
  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "published": return "success";
      case "rendering": return "warning";
      case "failed": return "destructive";
      case "draft": return "secondary";
      default: return "default";
    }
  };
  
  // Render track card
  const renderTrackCard = (track: Track, index: number) => {
    const isCurrentTrack = currentTrack?.id === track.id;
    const isTrackPlaying = isCurrentTrack && isPlaying;
    const audioUrl = (track as any).audio_signed_url || track.audio_url;
    const canPlay = !!audioUrl; // Allow playback for any track with audio_url
    
    if (viewMode === "list") {
      return (
        <Card key={track.id} className="hover:shadow-md transition-shadow">
          <div className="flex items-center p-4 gap-4">
            {/* Thumbnail */}
            <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
              {track.cover_image_url ? (
                <img
                  src={track.cover_image_url}
                  alt={track.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <MusicIcon className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">{track.title}</h3>
                <Badge variant={getStatusColor(track.status) as any} className="text-xs">
                  {track.status}
                </Badge>
                {track.ownership === "purchased" && (
                  <Badge variant="outline" className="text-xs" title={track.purchasedAt ? `Purchased on ${new Date(track.purchasedAt).toLocaleDateString()}` : undefined}>
                    Purchased
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {track.profiles?.display_name || "Unknown Artist"} • {formatDuration(track.duration)}
              </p>
              {track.tags && track.tags.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {track.tags.slice(0, 3).map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              {canPlay && (
                <Button
                  size="sm"
                  variant={isCurrentTrack ? "default" : "ghost"}
                  onClick={() => handlePlayTrack(track, index)}
                  className="h-8 w-8 p-0"
                >
                  {isTrackPlaying ? (
                    <PauseIcon className="h-4 w-4" />
                  ) : (
                    <PlayIcon className="h-4 w-4" />
                  )}
                </Button>
              )}
              {audioUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDownloadTrack(track)}
                  className="h-8 w-8 p-0"
                >
                  <DownloadIcon className="h-4 w-4" />
                </Button>
              )}
              {track.ownership === "owned" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEditTrack(track.id)}
                  className="h-8 w-8 p-0"
                >
                  <EditIcon className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </Card>
      );
    }
    
    // Grid view
    return (
      <Card key={track.id} className="hover:shadow-md transition-shadow h-full flex flex-col">
        {/* Image */}
        <div className="aspect-square rounded-t-lg overflow-hidden bg-muted flex items-center justify-center">
          {track.cover_image_url ? (
            <img
              src={track.cover_image_url}
              alt={track.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <MusicIcon className="h-16 w-16 text-muted-foreground" />
          )}
        </div>
        
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold line-clamp-1">{track.title}</h3>
            {canPlay && (
              <Button
                size="sm"
                variant={isCurrentTrack ? "default" : "ghost"}
                onClick={() => handlePlayTrack(track, index)}
                className="h-8 w-8 p-0 flex-shrink-0"
              >
                {isTrackPlaying ? (
                  <PauseIcon className="h-4 w-4" />
                ) : (
                  <PlayIcon className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {track.profiles?.display_name || "Unknown Artist"}
          </p>
        </CardHeader>
        
        <CardContent className="flex-1">
          <div className="flex flex-wrap gap-2 mb-3">
            <Badge variant={getStatusColor(track.status) as any} className="text-xs">
              {track.status}
            </Badge>
            {track.ownership === "purchased" && (
              <Badge variant="outline" className="text-xs" title={track.purchasedAt ? `Purchased on ${new Date(track.purchasedAt).toLocaleDateString()}` : undefined}>
                Purchased
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              <ClockIcon className="h-3 w-3 mr-1" />
              {formatDuration(track.duration)}
            </Badge>
          </div>
          
          {track.tags && track.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {track.tags.slice(0, 3).map(tag => (
                <Badge key={tag} variant="outline" className="text-xs">
                  <TagIcon className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            {audioUrl && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownloadTrack(track)}
                className="flex-1"
              >
                <DownloadIcon className="h-3 w-3 mr-1" />
                Download
              </Button>
            )}
            {track.ownership === "owned" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleEditTrack(track.id)}
                className="flex-1"
              >
                <EditIcon className="h-3 w-3 mr-1" />
                Edit
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          {/* User info and logout */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <UserIcon className="h-6 w-6 text-indigo-600" />
              </div>
              {user && (
                <div>
                  <p className="text-sm font-medium">{user.email}</p>
                  <p className="text-xs text-muted-foreground">Signed in</p>
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={isLoggingOut}
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

          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold">My Library</h1>
              <p className="text-muted-foreground mt-1">
                {totalTracks} {totalTracks === 1 ? "track" : "tracks"} in your collection
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => router.push('/builder')}
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                New Track
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={showFilters ? "bg-accent" : ""}
              >
                <FilterIcon className="h-4 w-4 mr-2" />
                Filters
              </Button>
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
          
          {/* Search Bar */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search your library..."
              value={filters.search}
              onChange={(e) => handleFilterChange({ search: e.target.value })}
              className="pl-10"
            />
          </div>
        </div>
      </div>
      
      {/* New Track Banner */}
      {isNewTrack && newTrackStatus !== 'complete' && (
        <div className={`border-b ${
          newTrackStatus === 'creating' ? 'bg-blue-50' : 'bg-yellow-50'
        }`}>
          <div className="container mx-auto px-4 py-4">
            <div className={`bg-white rounded-lg p-4 ${
              newTrackStatus === 'creating'
                ? 'border border-blue-200'
                : 'border border-yellow-200'
            } relative`}>
              <button
                onClick={() => setNewTrackStatus('complete')}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                aria-label="Dismiss"
              >
                <XIcon className="h-4 w-4" />
              </button>
              {newTrackStatus === 'creating' ? (
                <>
                  <h3 className="font-semibold text-blue-900 mb-1 flex items-center gap-2">
                    <Spinner className="h-4 w-4" />
                    Creating your track...
                  </h3>
                  <p className="text-blue-700 text-sm">Setting up your audio track with your selected voice and music.</p>
                  <p className="text-blue-600 text-xs mt-2">This should only take a few seconds...</p>
                </>
              ) : (
                <>
                  <h3 className="font-semibold text-yellow-900 mb-1 flex items-center gap-2">
                    <Spinner className="h-4 w-4" />
                    Rendering your audio...
                  </h3>
                  <p className="text-yellow-700 text-sm">We're processing your TTS, background music, and audio layers.</p>
                  <p className="text-yellow-600 text-xs mt-2">Your track will appear below once rendering is complete (usually 2-5 minutes).</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {showSuccessNotification && (
        <div className="border-b bg-green-50">
          <div className="container mx-auto px-4 py-4">
            <div className="bg-white border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 mb-1">✅ Your track is ready!</h3>
              <p className="text-green-700 text-sm">Rendering complete. You can now play, download, or share your track.</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="border-b bg-muted/30">
          <div className="container mx-auto px-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Ownership Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Ownership</label>
                <select
                  value={filters.ownership}
                  onChange={(e) => handleFilterChange({ ownership: e.target.value as OwnershipFilter })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
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
                  className="w-full px-3 py-2 border rounded-md bg-background"
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
                  className="w-full px-3 py-2 border rounded-md bg-background"
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
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
            </div>
            
            {/* Active Filters */}
            {hasActiveFilters && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  Active filters applied
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                >
                  <XIcon className="h-4 w-4 mr-2" />
                  Clear all filters
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Spinner className="h-12 w-12 mx-auto mb-4" />
              <p className="text-muted-foreground">Loading your tracks...</p>
            </div>
          </div>
        )}
        
        {/* Error State */}
        {error && !isLoading && (
          <div className="p-6 bg-destructive/10 border border-destructive rounded-lg">
            <p className="text-destructive">Error: {error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchTracks}
              className="mt-2"
            >
              Try again
            </Button>
          </div>
        )}
        
        {/* Tracks Grid/List */}
        {!isLoading && !error && tracks.length > 0 && (
          <div className={viewMode === "grid" 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" 
            : "space-y-4"
          }>
            {tracks.map((track, index) => renderTrackCard(track, index))}
          </div>
        )}
        
        {/* Empty State */}
        {!isLoading && !error && tracks.length === 0 && (
          <div className="text-center py-12">
            <FolderOpenIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No tracks found</h2>
            <p className="text-muted-foreground mb-4">
              {hasActiveFilters 
                ? "Try adjusting your filters to see more tracks" 
                : "Start creating or purchasing tracks to build your library"}
            </p>
            <div className="flex gap-2 justify-center">
              {hasActiveFilters && (
                <Button variant="outline" onClick={handleClearFilters}>
                  Clear filters
                </Button>
              )}
              <Button onClick={() => router.push("/builder")}>
                Create a Track
              </Button>
              <Button variant="outline" onClick={() => router.push("/marketplace")}>
                Browse Marketplace
              </Button>
            </div>
          </div>
        )}
        
        {/* Pagination */}
        {!isLoading && !error && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}