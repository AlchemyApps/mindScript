import TrackPlayer, { Event, RepeatMode } from 'react-native-track-player';
import { usePlayerStore } from '../stores/playerStore';

// This service runs in the background and handles all playback events
export async function PlaybackService() {
  // Handle remote play
  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    await TrackPlayer.play();
    usePlayerStore.getState().play();
  });

  // Handle remote pause
  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    await TrackPlayer.pause();
    usePlayerStore.getState().pause();
  });

  // Handle remote stop
  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    await TrackPlayer.stop();
    await TrackPlayer.reset();
    usePlayerStore.getState().clearQueue();
  });

  // Handle remote next
  TrackPlayer.addEventListener(Event.RemoteNext, async () => {
    await TrackPlayer.skipToNext();
    usePlayerStore.getState().skipToNext();
  });

  // Handle remote previous
  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    await TrackPlayer.skipToPrevious();
    usePlayerStore.getState().skipToPrevious();
  });

  // Handle remote seek
  TrackPlayer.addEventListener(Event.RemoteSeek, async (event) => {
    await TrackPlayer.seekTo(event.position);
    usePlayerStore.getState().seekTo(event.position);
  });

  // Handle remote duck (audio interruption)
  TrackPlayer.addEventListener(Event.RemoteDuck, async (event) => {
    if (event.paused) {
      await TrackPlayer.pause();
    } else if (event.permanent) {
      await TrackPlayer.stop();
    } else {
      // Resume playback at reduced volume
      const currentVolume = usePlayerStore.getState().volume;
      await TrackPlayer.setVolume(currentVolume * 0.5);

      // Restore volume after a delay
      setTimeout(async () => {
        await TrackPlayer.setVolume(currentVolume);
      }, 2000);
    }
  });

  // Handle playback queue ended
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
    const repeatMode = usePlayerStore.getState().repeatMode;

    if (repeatMode === RepeatMode.Queue) {
      // Restart queue from the beginning
      await TrackPlayer.skip(0);
      await TrackPlayer.play();
    } else {
      // Queue has ended, update store state
      usePlayerStore.getState().pause();
    }
  });

  // Handle playback error
  TrackPlayer.addEventListener(Event.PlaybackError, async (event) => {
    console.error('Playback error:', event);

    // Try to recover by skipping to the next track
    const hasNext = await TrackPlayer.getQueue().then(queue => {
      const currentIndex = usePlayerStore.getState().currentTrackIndex;
      return currentIndex !== null && currentIndex < queue.length - 1;
    });

    if (hasNext) {
      await TrackPlayer.skipToNext();
    } else {
      // No more tracks, stop playback
      await TrackPlayer.stop();
      usePlayerStore.getState().pause();
    }
  });

  // Handle metadata received (for streams)
  TrackPlayer.addEventListener(Event.PlaybackMetadataReceived, async (event) => {
    const { title, artist, artwork } = (event as any).metadata || {};

    if (title || artist || artwork) {
      const currentTrackIndex = usePlayerStore.getState().currentTrackIndex;

      if (currentTrackIndex !== null) {
        await TrackPlayer.updateMetadataForTrack(currentTrackIndex, {
          title: title || undefined,
          artist: artist || undefined,
          artwork: artwork || undefined,
        });
      }
    }
  });

  // Handle playback state changes
  TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
    // Sync playback state with store
    const store = usePlayerStore.getState();
    store.syncWithTrackPlayer();
  });

  // Handle active track changed
  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async (event) => {
    if (event.track !== undefined && event.track !== null) {
      const queue = await TrackPlayer.getQueue();
      const trackIndex = event.track as any as number;
      const track = trackIndex >= 0 ? queue[trackIndex] : null;

      const store = usePlayerStore.getState();
      if (track) {
        // Update current track in store
        store.syncWithTrackPlayer();

        // Check if we need to download the next track for offline playback
        const currentIndex = event.track as any as number;
        if (currentIndex < queue.length - 1) {
          const nextTrack = queue[currentIndex + 1];
          // Pre-cache next track if needed
          // This would integrate with cacheService
        }
      }
    }
  });

  // Handle remote jump forward (skip forward by interval)
  TrackPlayer.addEventListener(Event.RemoteJumpForward, async (event) => {
    const position = await TrackPlayer.getPosition();
    const duration = await TrackPlayer.getDuration();
    const newPosition = Math.min(position + (event.interval || 10), duration);

    await TrackPlayer.seekTo(newPosition);
  });

  // Handle remote jump backward (skip backward by interval)
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async (event) => {
    const position = await TrackPlayer.getPosition();
    const newPosition = Math.max(position - (event.interval || 10), 0);

    await TrackPlayer.seekTo(newPosition);
  });
}

// Register the playback service
export function registerPlaybackService() {
  TrackPlayer.registerPlaybackService(() => PlaybackService);
}