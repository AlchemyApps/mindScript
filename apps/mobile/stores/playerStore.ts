import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer, {
  Track,
  State,
  RepeatMode,
  Event,
  useProgress,
  usePlaybackState,
  PlaybackState,
  Capability,
  AddTrack,
} from 'react-native-track-player';

interface QueueItem extends Track {
  id: string;
  mindscriptId?: string;
  downloadProgress?: number;
  isDownloaded?: boolean;
  localPath?: string;
}

interface PlayerState {
  // Queue State
  queue: QueueItem[];
  currentTrackIndex: number | null;
  currentTrack: QueueItem | null;

  // Playback State
  isPlaying: boolean;
  playbackState: State;
  repeatMode: RepeatMode;
  shuffleMode: boolean;
  playbackRate: number;
  volume: number;

  // Sleep Timer
  sleepTimerActive: boolean;
  sleepTimerEndTime: number | null;
  sleepTimerDuration: number | null; // in minutes

  // UI State
  isPlayerExpanded: boolean;
  showQueue: boolean;

  // Error State
  error: string | null;

  // Actions - Queue Management
  setQueue: (tracks: QueueItem[]) => Promise<void>;
  addToQueue: (track: QueueItem, insertBeforeIndex?: number) => Promise<void>;
  removeFromQueue: (index: number) => Promise<void>;
  clearQueue: () => Promise<void>;
  moveInQueue: (fromIndex: number, toIndex: number) => Promise<void>;

  // Actions - Playback Control
  play: () => Promise<void>;
  pause: () => Promise<void>;
  skipToNext: () => Promise<void>;
  skipToPrevious: () => Promise<void>;
  skipTo: (index: number) => Promise<void>;
  seekTo: (position: number) => Promise<void>;

  // Actions - Playback Settings
  setRepeatMode: (mode: RepeatMode) => Promise<void>;
  toggleShuffle: () => Promise<void>;
  setPlaybackRate: (rate: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;

  // Actions - Sleep Timer
  setSleepTimer: (minutes: number) => void;
  cancelSleepTimer: () => void;
  checkSleepTimer: () => void;

  // Actions - UI State
  expandPlayer: () => void;
  collapsePlayer: () => void;
  toggleQueueDisplay: () => void;

  // Actions - Utilities
  clearError: () => void;
  syncWithTrackPlayer: () => Promise<void>;
  initialize: () => Promise<void>;
}

// Helper to convert internal queue items to TrackPlayer tracks
function toTrackPlayerTrack(item: QueueItem): AddTrack {
  return {
    id: item.id,
    url: item.localPath || item.url || '',
    title: item.title || 'Unknown',
    artist: item.artist || 'Unknown Artist',
    album: item.album,
    artwork: item.artwork,
    duration: item.duration,
  };
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      // Initial State
      queue: [],
      currentTrackIndex: null,
      currentTrack: null,
      isPlaying: false,
      playbackState: State.None,
      repeatMode: RepeatMode.Off,
      shuffleMode: false,
      playbackRate: 1.0,
      volume: 1.0,
      sleepTimerActive: false,
      sleepTimerEndTime: null,
      sleepTimerDuration: null,
      isPlayerExpanded: false,
      showQueue: false,
      error: null,

      // Initialize Track Player
      initialize: async () => {
        try {
          // Setup player
          await TrackPlayer.setupPlayer({
            maxCacheSize: 50 * 1024 * 1024, // 50 MB cache
          });

          // Add capabilities
          await TrackPlayer.updateOptions({
            capabilities: [
              Capability.Play,
              Capability.Pause,
              Capability.SkipToNext,
              Capability.SkipToPrevious,
              Capability.Stop,
              Capability.SeekTo,
            ],
            compactCapabilities: [
              Capability.Play,
              Capability.Pause,
              Capability.SkipToNext,
              Capability.SkipToPrevious,
            ],
            progressUpdateEventInterval: 1,
          });

          // Set up event listeners
          TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
            set({ playbackState: event.state });
          });

          TrackPlayer.addEventListener(Event.PlaybackTrackChanged, async (event) => {
            if (event.nextTrack !== undefined) {
              const queue = get().queue;
              const track = queue[event.nextTrack];
              set({
                currentTrackIndex: event.nextTrack,
                currentTrack: track || null,
              });
            }
          });

          TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
            set({ isPlaying: false });
            // Check if repeat all is enabled
            const repeatMode = get().repeatMode;
            if (repeatMode === RepeatMode.Queue) {
              get().skipTo(0);
              get().play();
            }
          });

          // Sync initial state
          await get().syncWithTrackPlayer();
        } catch (error) {
          console.error('Failed to initialize TrackPlayer:', error);
          set({ error: error instanceof Error ? error.message : 'Failed to initialize player' });
        }
      },

      // Queue Management
      setQueue: async (tracks: QueueItem[]) => {
        try {
          await TrackPlayer.reset();

          if (tracks.length > 0) {
            const trackPlayerTracks = tracks.map(toTrackPlayerTrack);
            await TrackPlayer.add(trackPlayerTracks);

            set({
              queue: tracks,
              currentTrackIndex: 0,
              currentTrack: tracks[0],
              error: null,
            });
          } else {
            set({
              queue: [],
              currentTrackIndex: null,
              currentTrack: null,
            });
          }
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to set queue' });
        }
      },

      addToQueue: async (track: QueueItem, insertBeforeIndex?: number) => {
        try {
          const trackPlayerTrack = toTrackPlayerTrack(track);

          if (insertBeforeIndex !== undefined) {
            await TrackPlayer.add(trackPlayerTrack, insertBeforeIndex);
            const newQueue = [...get().queue];
            newQueue.splice(insertBeforeIndex, 0, track);
            set({ queue: newQueue });
          } else {
            await TrackPlayer.add(trackPlayerTrack);
            set({ queue: [...get().queue, track] });
          }

          set({ error: null });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to add track to queue' });
        }
      },

      removeFromQueue: async (index: number) => {
        try {
          await TrackPlayer.remove(index);
          const newQueue = [...get().queue];
          newQueue.splice(index, 1);

          // Update current track if needed
          const currentIndex = get().currentTrackIndex;
          if (currentIndex !== null) {
            if (index === currentIndex) {
              // Removed current track
              const newCurrentIndex = Math.min(currentIndex, newQueue.length - 1);
              set({
                queue: newQueue,
                currentTrackIndex: newCurrentIndex >= 0 ? newCurrentIndex : null,
                currentTrack: newCurrentIndex >= 0 ? newQueue[newCurrentIndex] : null,
              });
            } else if (index < currentIndex) {
              // Removed track before current
              set({
                queue: newQueue,
                currentTrackIndex: currentIndex - 1,
              });
            } else {
              // Removed track after current
              set({ queue: newQueue });
            }
          } else {
            set({ queue: newQueue });
          }

          set({ error: null });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to remove track from queue' });
        }
      },

      clearQueue: async () => {
        try {
          await TrackPlayer.reset();
          set({
            queue: [],
            currentTrackIndex: null,
            currentTrack: null,
            isPlaying: false,
            error: null,
          });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to clear queue' });
        }
      },

      moveInQueue: async (fromIndex: number, toIndex: number) => {
        try {
          // TrackPlayer doesn't have a direct move method, so we need to remove and re-add
          const queue = get().queue;
          const track = queue[fromIndex];

          await TrackPlayer.remove(fromIndex);
          await TrackPlayer.add(toTrackPlayerTrack(track), toIndex);

          const newQueue = [...queue];
          newQueue.splice(fromIndex, 1);
          newQueue.splice(toIndex, 0, track);

          // Update current track index if needed
          const currentIndex = get().currentTrackIndex;
          let newCurrentIndex = currentIndex;

          if (currentIndex !== null) {
            if (fromIndex === currentIndex) {
              newCurrentIndex = toIndex;
            } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
              newCurrentIndex = currentIndex - 1;
            } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
              newCurrentIndex = currentIndex + 1;
            }
          }

          set({
            queue: newQueue,
            currentTrackIndex: newCurrentIndex,
            error: null,
          });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to move track in queue' });
        }
      },

      // Playback Control
      play: async () => {
        try {
          await TrackPlayer.play();
          set({ isPlaying: true, error: null });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to play' });
        }
      },

      pause: async () => {
        try {
          await TrackPlayer.pause();
          set({ isPlaying: false, error: null });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to pause' });
        }
      },

      skipToNext: async () => {
        try {
          await TrackPlayer.skipToNext();
          set({ error: null });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to skip to next' });
        }
      },

      skipToPrevious: async () => {
        try {
          await TrackPlayer.skipToPrevious();
          set({ error: null });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to skip to previous' });
        }
      },

      skipTo: async (index: number) => {
        try {
          await TrackPlayer.skip(index);
          set({ error: null });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to skip to track' });
        }
      },

      seekTo: async (position: number) => {
        try {
          await TrackPlayer.seekTo(position);
          set({ error: null });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to seek' });
        }
      },

      // Playback Settings
      setRepeatMode: async (mode: RepeatMode) => {
        try {
          await TrackPlayer.setRepeatMode(mode);
          set({ repeatMode: mode, error: null });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to set repeat mode' });
        }
      },

      toggleShuffle: async () => {
        const newShuffleMode = !get().shuffleMode;
        set({ shuffleMode: newShuffleMode });

        // Note: TrackPlayer doesn't have built-in shuffle
        // We'll need to implement queue shuffling manually if needed
        if (newShuffleMode) {
          // Shuffle logic here
          // This is a placeholder - actual implementation would shuffle the queue
          console.log('Shuffle enabled - implement queue shuffling');
        } else {
          // Restore original queue order
          console.log('Shuffle disabled - restore original queue order');
        }
      },

      setPlaybackRate: async (rate: number) => {
        try {
          await TrackPlayer.setRate(rate);
          set({ playbackRate: rate, error: null });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to set playback rate' });
        }
      },

      setVolume: async (volume: number) => {
        try {
          await TrackPlayer.setVolume(volume);
          set({ volume, error: null });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to set volume' });
        }
      },

      // Sleep Timer
      setSleepTimer: (minutes: number) => {
        const endTime = Date.now() + minutes * 60 * 1000;
        set({
          sleepTimerActive: true,
          sleepTimerEndTime: endTime,
          sleepTimerDuration: minutes,
        });

        // Start checking timer
        const checkInterval = setInterval(() => {
          get().checkSleepTimer();
        }, 1000);

        // Store interval ID for cleanup (would need to add this to state)
        (global as any).sleepTimerInterval = checkInterval;
      },

      cancelSleepTimer: () => {
        set({
          sleepTimerActive: false,
          sleepTimerEndTime: null,
          sleepTimerDuration: null,
        });

        // Clear interval
        if ((global as any).sleepTimerInterval) {
          clearInterval((global as any).sleepTimerInterval);
          (global as any).sleepTimerInterval = null;
        }
      },

      checkSleepTimer: () => {
        const { sleepTimerActive, sleepTimerEndTime } = get();

        if (sleepTimerActive && sleepTimerEndTime) {
          const now = Date.now();
          const timeRemaining = sleepTimerEndTime - now;

          if (timeRemaining <= 0) {
            // Timer expired - pause playback with fade out
            get().pause();
            get().cancelSleepTimer();
          } else if (timeRemaining <= 10000) {
            // Last 10 seconds - could implement fade out here
            const fadeVolume = get().volume * (timeRemaining / 10000);
            get().setVolume(fadeVolume);
          }
        }
      },

      // UI State
      expandPlayer: () => set({ isPlayerExpanded: true }),
      collapsePlayer: () => set({ isPlayerExpanded: false }),
      toggleQueueDisplay: () => set({ showQueue: !get().showQueue }),

      // Utilities
      clearError: () => set({ error: null }),

      syncWithTrackPlayer: async () => {
        try {
          const queue = await TrackPlayer.getQueue();
          const currentTrackIndex = await TrackPlayer.getCurrentTrack();
          const playbackState = await TrackPlayer.getState();
          const repeatMode = await TrackPlayer.getRepeatMode();
          const volume = await TrackPlayer.getVolume();
          const rate = await TrackPlayer.getRate();

          set({
            queue: queue as QueueItem[],
            currentTrackIndex,
            currentTrack: currentTrackIndex !== null ? (queue[currentTrackIndex] as QueueItem) : null,
            playbackState,
            repeatMode,
            volume,
            playbackRate: rate,
            isPlaying: playbackState === State.Playing,
          });
        } catch (error) {
          console.error('Failed to sync with TrackPlayer:', error);
        }
      },
    }),
    {
      name: 'player-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Persist user preferences
        repeatMode: state.repeatMode,
        shuffleMode: state.shuffleMode,
        playbackRate: state.playbackRate,
        volume: state.volume,
        // Optionally persist queue
        queue: state.queue,
        currentTrackIndex: state.currentTrackIndex,
      }),
    }
  )
);