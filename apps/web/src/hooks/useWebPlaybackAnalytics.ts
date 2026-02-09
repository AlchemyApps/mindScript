import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { trackPlaybackEvent, incrementPlayCount } from '@/lib/playback-analytics';
import { getSupabaseBrowserClient } from '@mindscript/auth/client';

/**
 * Subscribes to playerStore state changes and emits playback events
 * to the playback_events table. Call once at the MiniPlayer level.
 */
export function useWebPlaybackAnalytics() {
  const userIdRef = useRef<string | null>(null);
  const prevTrackIdRef = useRef<string | null>(null);
  const prevIsPlayingRef = useRef(false);
  const playStartTimeRef = useRef<number | null>(null);
  const playStartPositionRef = useRef<number>(0);

  // Resolve current user ID once
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      userIdRef.current = user?.id ?? null;
      _setAnalyticsUserId(user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      userIdRef.current = session?.user?.id ?? null;
      _setAnalyticsUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Subscribe to store changes
  useEffect(() => {
    const unsubscribe = usePlayerStore.subscribe((state) => {
      const userId = userIdRef.current;
      if (!userId) return;

      const { currentTrack, isPlaying, currentTime, duration } = state;
      const trackId = currentTrack?.id ?? null;
      const prevTrackId = prevTrackIdRef.current;
      const wasPlaying = prevIsPlayingRef.current;

      // Track changed while playing — skip event for the old track
      if (trackId !== prevTrackId && prevTrackId && wasPlaying) {
        const listened = playStartTimeRef.current
          ? Math.floor((Date.now() - playStartTimeRef.current) / 1000)
          : 0;
        trackPlaybackEvent(userId, {
          trackId: prevTrackId,
          eventType: 'skip',
          durationListenedSeconds: listened,
          totalTrackDurationSeconds: duration,
          positionSeconds: currentTime,
        });
        playStartTimeRef.current = null;
      }

      // New track started playing — play event
      if (trackId && trackId !== prevTrackId && isPlaying) {
        playStartTimeRef.current = Date.now();
        playStartPositionRef.current = currentTime;
        trackPlaybackEvent(userId, {
          trackId,
          eventType: 'play',
          positionSeconds: currentTime,
          totalTrackDurationSeconds: duration,
        });
        incrementPlayCount(trackId);
      }

      // Same track — play/pause transitions
      if (trackId && trackId === prevTrackId) {
        if (isPlaying && !wasPlaying) {
          // Resumed
          playStartTimeRef.current = Date.now();
          playStartPositionRef.current = currentTime;
          trackPlaybackEvent(userId, {
            trackId,
            eventType: prevTrackId ? 'resume' : 'play',
            positionSeconds: currentTime,
            totalTrackDurationSeconds: duration,
          });
        } else if (!isPlaying && wasPlaying) {
          // Paused
          const listened = playStartTimeRef.current
            ? Math.floor((Date.now() - playStartTimeRef.current) / 1000)
            : 0;
          trackPlaybackEvent(userId, {
            trackId,
            eventType: 'pause',
            durationListenedSeconds: listened,
            positionSeconds: currentTime,
            totalTrackDurationSeconds: duration,
          });
          playStartTimeRef.current = null;
        }
      }

      prevTrackIdRef.current = trackId;
      prevIsPlayingRef.current = isPlaying;
    });

    return () => unsubscribe();
  }, []);
}

/**
 * Call this when a track reaches its natural end (onEnded).
 * Emits a 'complete' event before the player moves to the next track.
 */
export function emitTrackComplete() {
  const userId = getUserId();
  if (!userId) return;

  const state = usePlayerStore.getState();
  const { currentTrack, duration } = state;
  if (!currentTrack) return;

  trackPlaybackEvent(userId, {
    trackId: currentTrack.id,
    eventType: 'complete',
    durationListenedSeconds: Math.floor(duration),
    totalTrackDurationSeconds: Math.floor(duration),
    positionSeconds: duration,
  });
}

function getUserId(): string | null {
  // Quick sync check — the ref is populated by the hook
  // For the standalone emitTrackComplete function, we need to fetch it
  // We'll use a module-level cache that the hook keeps warm
  return _cachedUserId;
}

let _cachedUserId: string | null = null;

// Keep module cache warm — called by the hook's auth effect
export function _setAnalyticsUserId(id: string | null) {
  _cachedUserId = id;
}
