import TrackPlayer, { Event, RepeatMode } from 'react-native-track-player';
import { usePlayerStore } from '../stores/playerStore';

export async function PlaybackService() {
  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    await TrackPlayer.play();
  });

  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    await TrackPlayer.pause();
  });

  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    await TrackPlayer.stop();
    await TrackPlayer.reset();
  });

  TrackPlayer.addEventListener(Event.RemoteNext, async () => {
    await TrackPlayer.skipToNext();
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    await TrackPlayer.skipToPrevious();
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, async (event) => {
    await TrackPlayer.seekTo(event.position);
  });

  TrackPlayer.addEventListener(Event.RemoteJumpForward, async (event) => {
    const position = await TrackPlayer.getPosition();
    const duration = await TrackPlayer.getDuration();
    await TrackPlayer.seekTo(
      Math.min(position + (event.interval || 10), duration),
    );
  });

  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async (event) => {
    const position = await TrackPlayer.getPosition();
    await TrackPlayer.seekTo(
      Math.max(position - (event.interval || 10), 0),
    );
  });

  TrackPlayer.addEventListener(Event.RemoteDuck, async (event) => {
    if (event.paused) {
      await TrackPlayer.pause();
    } else if (event.permanent) {
      await TrackPlayer.stop();
    } else {
      // Ducking — lower volume temporarily
      const currentVolume = usePlayerStore.getState().volume;
      await TrackPlayer.setVolume(currentVolume * 0.3);
      setTimeout(async () => {
        await TrackPlayer.setVolume(currentVolume);
      }, 2000);
    }
  });

  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async () => {
    const repeatMode = usePlayerStore.getState().repeatMode;
    if (repeatMode === RepeatMode.Queue) {
      await TrackPlayer.skip(0);
      await TrackPlayer.play();
    }
  });

  TrackPlayer.addEventListener(Event.PlaybackError, async () => {
    const queue = await TrackPlayer.getQueue();
    const activeTrack = await TrackPlayer.getActiveTrack();
    const currentIndex = activeTrack
      ? queue.findIndex((t) => t.id === activeTrack.id)
      : -1;

    if (currentIndex >= 0 && currentIndex < queue.length - 1) {
      await TrackPlayer.skipToNext();
    } else {
      await TrackPlayer.stop();
    }
  });

  TrackPlayer.addEventListener(Event.PlaybackState, () => {
    usePlayerStore.getState().syncWithTrackPlayer();
  });

  TrackPlayer.addEventListener(
    Event.PlaybackActiveTrackChanged,
    async () => {
      usePlayerStore.getState().syncWithTrackPlayer();
    },
  );
}
