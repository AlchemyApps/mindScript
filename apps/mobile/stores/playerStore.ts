import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer } from 'expo-audio';
import type { AudioPlayer, AudioStatus } from 'expo-audio';

export interface QueueItem {
  id: string;
  url: string;
  title?: string;
  artist?: string;
  album?: string;
  artwork?: string;
  duration?: number;
  mindscriptId?: string;
  isDownloaded?: boolean;
  localPath?: string;
}

export type RepeatMode = 'off' | 'track' | 'queue';

// ---------------------------------------------------------------------------
// Module-level AudioPlayer (reused via replace())
// ---------------------------------------------------------------------------
let player: AudioPlayer | null = null;

function getOrCreatePlayer(): AudioPlayer {
  if (!player) {
    player = createAudioPlayer(null, { updateInterval: 250 });

    player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
      usePlayerStore.setState({
        isPlaying: status.playing,
        position: status.currentTime,
        duration: status.duration,
      });

      if (status.didJustFinish && !status.loop) {
        handleTrackFinished();
      }
    });
  }
  return player;
}

function cleanupPlayer(): void {
  if (player) {
    try {
      player.remove();
    } catch {
      // ignore cleanup errors
    }
    player = null;
  }
}

function loadTrack(track: QueueItem, shouldPlay: boolean): void {
  const url = track.localPath || track.url;
  if (!url) return;

  const p = getOrCreatePlayer();
  p.replace(url);

  // Apply persisted settings
  const { volume, playbackRate, repeatMode } = usePlayerStore.getState();
  p.volume = volume;
  p.setPlaybackRate(playbackRate);
  p.loop = repeatMode === 'track';

  if (shouldPlay) {
    p.play();
  }
}

function handleTrackFinished(): void {
  const { queue, currentTrackIndex, repeatMode } = usePlayerStore.getState();

  if (repeatMode === 'track') {
    // Looping is handled natively via player.loop
    return;
  }

  if (currentTrackIndex !== null && currentTrackIndex < queue.length - 1) {
    usePlayerStore.getState().skipToNext();
  } else if (repeatMode === 'queue' && queue.length > 0) {
    usePlayerStore.getState().skipTo(0);
  } else {
    usePlayerStore.setState({ isPlaying: false });
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
interface PlayerState {
  queue: QueueItem[];
  currentTrackIndex: number | null;
  currentTrack: QueueItem | null;

  isPlaying: boolean;
  position: number;
  duration: number;
  repeatMode: RepeatMode;
  playbackRate: number;
  volume: number;

  sleepTimerActive: boolean;
  sleepTimerEndTime: number | null;
  sleepTimerDuration: number | null;

  isPlayerExpanded: boolean;
  showQueue: boolean;
  error: string | null;

  playbackSessionId: string | null;

  // Actions
  setQueue: (tracks: QueueItem[]) => void;
  addToQueue: (track: QueueItem, insertBeforeIndex?: number) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  moveInQueue: (fromIndex: number, toIndex: number) => void;
  play: () => void;
  pause: () => void;
  skipToNext: () => void;
  skipToPrevious: () => void;
  skipTo: (index: number) => void;
  seekTo: (position: number) => Promise<void>;
  setRepeatMode: (mode: RepeatMode) => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  setSleepTimer: (minutes: number) => void;
  cancelSleepTimer: () => void;
  checkSleepTimer: () => void;
  expandPlayer: () => void;
  collapsePlayer: () => void;
  toggleQueueDisplay: () => void;
  clearError: () => void;
  initialize: () => Promise<void>;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      currentTrackIndex: null,
      currentTrack: null,
      isPlaying: false,
      position: 0,
      duration: 0,
      repeatMode: 'off' as RepeatMode,
      playbackRate: 1.0,
      volume: 1.0,
      sleepTimerActive: false,
      sleepTimerEndTime: null,
      sleepTimerDuration: null,
      isPlayerExpanded: false,
      showQueue: false,
      error: null,
      playbackSessionId: null,

      initialize: async () => {
        // expo-audio: audio mode configured in backgroundAudio.ts
        // Player is created on demand when a track is loaded
      },

      setQueue: (tracks: QueueItem[]) => {
        if (tracks.length > 0) {
          set({
            queue: tracks,
            currentTrackIndex: 0,
            currentTrack: tracks[0],
            position: 0,
            duration: 0,
            error: null,
          });
          loadTrack(tracks[0], true);
        } else {
          cleanupPlayer();
          set({
            queue: [],
            currentTrackIndex: null,
            currentTrack: null,
            isPlaying: false,
            position: 0,
            duration: 0,
          });
        }
      },

      addToQueue: (track: QueueItem, insertBeforeIndex?: number) => {
        const newQueue = [...get().queue];
        if (insertBeforeIndex !== undefined) {
          newQueue.splice(insertBeforeIndex, 0, track);
        } else {
          newQueue.push(track);
        }
        set({ queue: newQueue, error: null });
      },

      removeFromQueue: (index: number) => {
        const newQueue = [...get().queue];
        newQueue.splice(index, 1);

        const currentIndex = get().currentTrackIndex;
        if (currentIndex !== null) {
          if (index === currentIndex) {
            const newIdx = Math.min(currentIndex, newQueue.length - 1);
            const newTrack = newIdx >= 0 ? newQueue[newIdx] : null;
            set({
              queue: newQueue,
              currentTrackIndex: newIdx >= 0 ? newIdx : null,
              currentTrack: newTrack,
            });
            if (newTrack) {
              loadTrack(newTrack, get().isPlaying);
            } else {
              cleanupPlayer();
              set({ isPlaying: false, position: 0, duration: 0 });
            }
          } else if (index < currentIndex) {
            set({ queue: newQueue, currentTrackIndex: currentIndex - 1 });
          } else {
            set({ queue: newQueue });
          }
        } else {
          set({ queue: newQueue });
        }
      },

      clearQueue: () => {
        cleanupPlayer();
        set({
          queue: [],
          currentTrackIndex: null,
          currentTrack: null,
          isPlaying: false,
          position: 0,
          duration: 0,
          error: null,
        });
      },

      moveInQueue: (fromIndex: number, toIndex: number) => {
        const queue = [...get().queue];
        const [item] = queue.splice(fromIndex, 1);
        queue.splice(toIndex, 0, item);

        let currentIndex = get().currentTrackIndex;
        if (currentIndex !== null) {
          if (fromIndex === currentIndex) {
            currentIndex = toIndex;
          } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
            currentIndex--;
          } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
            currentIndex++;
          }
        }

        set({ queue, currentTrackIndex: currentIndex, error: null });
      },

      play: () => {
        // Cold start: no player but we have a current track
        if (!player) {
          const track = get().currentTrack;
          if (track) {
            loadTrack(track, true);
            return;
          }
        }
        if (player) {
          player.play();
        }
        set({ isPlaying: true, error: null });
      },

      pause: () => {
        if (player) {
          player.pause();
        }
        set({ isPlaying: false, error: null });
      },

      skipToNext: () => {
        const { queue, currentTrackIndex } = get();
        if (currentTrackIndex === null || currentTrackIndex >= queue.length - 1)
          return;
        const nextIndex = currentTrackIndex + 1;
        const nextTrack = queue[nextIndex];
        set({
          currentTrackIndex: nextIndex,
          currentTrack: nextTrack,
          position: 0,
        });
        loadTrack(nextTrack, true);
      },

      skipToPrevious: () => {
        const { queue, currentTrackIndex, position } = get();
        if (currentTrackIndex === null) return;

        // If more than 3 seconds in, restart current track
        if (position > 3 && player) {
          player.seekTo(0);
          set({ position: 0 });
          return;
        }

        if (currentTrackIndex <= 0) return;
        const prevIndex = currentTrackIndex - 1;
        const prevTrack = queue[prevIndex];
        set({
          currentTrackIndex: prevIndex,
          currentTrack: prevTrack,
          position: 0,
        });
        loadTrack(prevTrack, true);
      },

      skipTo: (index: number) => {
        const { queue } = get();
        if (index < 0 || index >= queue.length) return;
        const track = queue[index];
        set({ currentTrackIndex: index, currentTrack: track, position: 0 });
        loadTrack(track, true);
      },

      seekTo: async (position: number) => {
        if (player) {
          await player.seekTo(position);
        }
        set({ position });
      },

      setRepeatMode: (mode: RepeatMode) => {
        set({ repeatMode: mode });
        if (player) {
          player.loop = mode === 'track';
        }
      },

      setPlaybackRate: (rate: number) => {
        if (player) {
          player.setPlaybackRate(rate);
        }
        set({ playbackRate: rate });
      },

      setVolume: (volume: number) => {
        if (player) {
          player.volume = volume;
        }
        set({ volume });
      },

      setSleepTimer: (minutes: number) => {
        const endTime = Date.now() + minutes * 60 * 1000;
        set({
          sleepTimerActive: true,
          sleepTimerEndTime: endTime,
          sleepTimerDuration: minutes,
        });

        if ((global as Record<string, unknown>).sleepTimerInterval) {
          clearInterval(
            (global as Record<string, unknown>)
              .sleepTimerInterval as ReturnType<typeof setInterval>,
          );
        }
        (global as Record<string, unknown>).sleepTimerInterval = setInterval(
          () => get().checkSleepTimer(),
          1000,
        );
      },

      cancelSleepTimer: () => {
        set({
          sleepTimerActive: false,
          sleepTimerEndTime: null,
          sleepTimerDuration: null,
        });
        if ((global as Record<string, unknown>).sleepTimerInterval) {
          clearInterval(
            (global as Record<string, unknown>)
              .sleepTimerInterval as ReturnType<typeof setInterval>,
          );
          (global as Record<string, unknown>).sleepTimerInterval = null;
        }
      },

      checkSleepTimer: () => {
        const { sleepTimerActive, sleepTimerEndTime } = get();
        if (sleepTimerActive && sleepTimerEndTime) {
          const timeRemaining = sleepTimerEndTime - Date.now();
          if (timeRemaining <= 0) {
            get().pause();
            get().cancelSleepTimer();
          } else if (timeRemaining <= 10000) {
            const fadeVolume = get().volume * (timeRemaining / 10000);
            get().setVolume(fadeVolume);
          }
        }
      },

      expandPlayer: () => set({ isPlayerExpanded: true }),
      collapsePlayer: () => set({ isPlayerExpanded: false }),
      toggleQueueDisplay: () => set({ showQueue: !get().showQueue }),
      clearError: () => set({ error: null }),
    }),
    {
      name: 'player-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        repeatMode: state.repeatMode,
        playbackRate: state.playbackRate,
        volume: state.volume,
        queue: state.queue,
        currentTrackIndex: state.currentTrackIndex,
      }),
    },
  ),
);
