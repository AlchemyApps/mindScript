import { useEffect, useRef } from 'react';
import { useProgress } from 'react-native-track-player';
import { usePlayerStore } from '../stores/playerStore';
import { useAuthStore } from '../stores/authStore';
import {
  trackPlaybackEvent,
  incrementPlayCount,
  getSessionId,
} from '../lib/analytics';

/**
 * Emits playback analytics events based on player state transitions.
 * Call this once in the root layout — it hooks into playerStore and
 * emits play/pause/complete/skip events to playback_events.
 */
export function usePlaybackAnalytics() {
  const user = useAuthStore((s) => s.user);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const { position, duration } = useProgress(1000);

  const prevTrackIdRef = useRef<string | null>(null);
  const prevIsPlayingRef = useRef(false);
  const playStartPositionRef = useRef(0);
  const hasEmittedPlayRef = useRef(false);

  useEffect(() => {
    if (!user || !currentTrack) return;

    const trackId = currentTrack.id;
    const sessionId = getSessionId();

    // Track changed — emit skip for previous track
    if (
      prevTrackIdRef.current &&
      prevTrackIdRef.current !== trackId &&
      hasEmittedPlayRef.current
    ) {
      trackPlaybackEvent(user.id, {
        trackId: prevTrackIdRef.current,
        eventType: 'skip',
        durationListenedSeconds: Math.round(
          position - playStartPositionRef.current,
        ),
        totalTrackDurationSeconds: Math.round(duration),
        positionSeconds: position,
        sessionId,
      });
      hasEmittedPlayRef.current = false;
    }

    // Play started
    if (isPlaying && !prevIsPlayingRef.current) {
      const eventType = hasEmittedPlayRef.current ? 'resume' : 'play';
      trackPlaybackEvent(user.id, {
        trackId,
        eventType,
        positionSeconds: position,
        totalTrackDurationSeconds: Math.round(duration),
        sessionId,
      });

      if (eventType === 'play') {
        incrementPlayCount(trackId);
      }

      playStartPositionRef.current = position;
      hasEmittedPlayRef.current = true;
    }

    // Pause
    if (!isPlaying && prevIsPlayingRef.current && hasEmittedPlayRef.current) {
      const listened = Math.round(position - playStartPositionRef.current);

      // Check if track completed (position near end)
      const isComplete = duration > 0 && duration - position < 2;

      trackPlaybackEvent(user.id, {
        trackId,
        eventType: isComplete ? 'complete' : 'pause',
        durationListenedSeconds: Math.max(listened, 0),
        totalTrackDurationSeconds: Math.round(duration),
        positionSeconds: position,
        sessionId,
      });

      if (isComplete) {
        hasEmittedPlayRef.current = false;
      }
    }

    prevTrackIdRef.current = trackId;
    prevIsPlayingRef.current = isPlaying;
  }, [isPlaying, currentTrack?.id, user, position, duration]);
}
