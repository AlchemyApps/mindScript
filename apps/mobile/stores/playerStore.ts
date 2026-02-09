import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer, {
  Track,
  State,
  RepeatMode,
  Event,
  Capability,
  AddTrack,
} from 'react-native-track-player';

export interface QueueItem extends Track {
  id: string;
  mindscriptId?: string;
  isDownloaded?: boolean;
  localPath?: string;
}

interface PlayerState {
  queue: QueueItem[];
  currentTrackIndex: number | null;
  currentTrack: QueueItem | null;

  isPlaying: boolean;
  playbackState: State;
  repeatMode: RepeatMode;
  playbackRate: number;
  volume: number;

  sleepTimerActive: boolean;
  sleepTimerEndTime: number | null;
  sleepTimerDuration: number | null;

  isPlayerExpanded: boolean;
  showQueue: boolean;
  error: string | null;

  // Session tracking for analytics
  playbackSessionId: string | null;

  // Actions
  setQueue: (tracks: QueueItem[]) => Promise<void>;
  addToQueue: (track: QueueItem, insertBeforeIndex?: number) => Promise<void>;
  removeFromQueue: (index: number) => Promise<void>;
  clearQueue: () => Promise<void>;
  moveInQueue: (fromIndex: number, toIndex: number) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  skipToNext: () => Promise<void>;
  skipToPrevious: () => Promise<void>;
  skipTo: (index: number) => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  setRepeatMode: (mode: RepeatMode) => Promise<void>;
  setPlaybackRate: (rate: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  setSleepTimer: (minutes: number) => void;
  cancelSleepTimer: () => void;
  checkSleepTimer: () => void;
  expandPlayer: () => void;
  collapsePlayer: () => void;
  toggleQueueDisplay: () => void;
  clearError: () => void;
  syncWithTrackPlayer: () => Promise<void>;
  initialize: () => Promise<void>;
}

function toTrackPlayerTrack(item: QueueItem): AddTrack {
  return {
    id: item.id,
    url: item.localPath || item.url || '',
    title: item.title || 'Unknown',
    artist: item.artist || 'MindScript',
    album: item.album,
    artwork: item.artwork,
    duration: item.duration,
  };
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      currentTrackIndex: null,
      currentTrack: null,
      isPlaying: false,
      playbackState: State.None,
      repeatMode: RepeatMode.Off,
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
        try {
          await TrackPlayer.setupPlayer({
            maxCacheSize: 50 * 1024 * 1024,
          });

          await TrackPlayer.updateOptions({
            capabilities: [
              Capability.Play,
              Capability.Pause,
              Capability.SkipToNext,
              Capability.SkipToPrevious,
              Capability.Stop,
              Capability.SeekTo,
              Capability.JumpForward,
              Capability.JumpBackward,
            ],
            compactCapabilities: [
              Capability.Play,
              Capability.Pause,
              Capability.SkipToNext,
              Capability.SkipToPrevious,
            ],
            progressUpdateEventInterval: 1,
            forwardJumpInterval: 10,
            backwardJumpInterval: 10,
          });

          TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
            set({
              playbackState: event.state,
              isPlaying: event.state === State.Playing,
            });
          });

          TrackPlayer.addEventListener(
            Event.PlaybackActiveTrackChanged,
            async (event) => {
              if (event.index !== undefined && event.index !== null) {
                const queue = get().queue;
                const track =
                  event.index >= 0 && event.index < queue.length
                    ? queue[event.index]
                    : null;
                set({
                  currentTrackIndex: event.index,
                  currentTrack: track,
                });
              }
            },
          );

          TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
            set({ isPlaying: false });
            const repeatMode = get().repeatMode;
            if (repeatMode === RepeatMode.Queue) {
              get().skipTo(0);
              get().play();
            }
          });

          await get().syncWithTrackPlayer();
        } catch (error) {
          console.error('Failed to initialize TrackPlayer:', error);
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to initialize player',
          });
        }
      },

      setQueue: async (tracks: QueueItem[]) => {
        try {
          await TrackPlayer.reset();
          if (tracks.length > 0) {
            await TrackPlayer.add(tracks.map(toTrackPlayerTrack));
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
          set({
            error:
              error instanceof Error ? error.message : 'Failed to set queue',
          });
        }
      },

      addToQueue: async (track: QueueItem, insertBeforeIndex?: number) => {
        try {
          const tp = toTrackPlayerTrack(track);
          if (insertBeforeIndex !== undefined) {
            await TrackPlayer.add(tp, insertBeforeIndex);
            const newQueue = [...get().queue];
            newQueue.splice(insertBeforeIndex, 0, track);
            set({ queue: newQueue });
          } else {
            await TrackPlayer.add(tp);
            set({ queue: [...get().queue, track] });
          }
          set({ error: null });
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to add to queue',
          });
        }
      },

      removeFromQueue: async (index: number) => {
        try {
          await TrackPlayer.remove(index);
          const newQueue = [...get().queue];
          newQueue.splice(index, 1);

          const currentIndex = get().currentTrackIndex;
          if (currentIndex !== null) {
            if (index === currentIndex) {
              const newIdx = Math.min(currentIndex, newQueue.length - 1);
              set({
                queue: newQueue,
                currentTrackIndex: newIdx >= 0 ? newIdx : null,
                currentTrack: newIdx >= 0 ? newQueue[newIdx] : null,
              });
            } else if (index < currentIndex) {
              set({ queue: newQueue, currentTrackIndex: currentIndex - 1 });
            } else {
              set({ queue: newQueue });
            }
          } else {
            set({ queue: newQueue });
          }
          set({ error: null });
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to remove from queue',
          });
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
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to clear queue',
          });
        }
      },

      moveInQueue: async (fromIndex: number, toIndex: number) => {
        try {
          const queue = get().queue;
          const track = queue[fromIndex];
          await TrackPlayer.remove(fromIndex);
          await TrackPlayer.add(toTrackPlayerTrack(track), toIndex);

          const newQueue = [...queue];
          newQueue.splice(fromIndex, 1);
          newQueue.splice(toIndex, 0, track);

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

          set({ queue: newQueue, currentTrackIndex: newCurrentIndex, error: null });
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to move track',
          });
        }
      },

      play: async () => {
        try {
          await TrackPlayer.play();
          set({ isPlaying: true, error: null });
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : 'Failed to play',
          });
        }
      },

      pause: async () => {
        try {
          await TrackPlayer.pause();
          set({ isPlaying: false, error: null });
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : 'Failed to pause',
          });
        }
      },

      skipToNext: async () => {
        try {
          await TrackPlayer.skipToNext();
          set({ error: null });
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : 'Failed to skip next',
          });
        }
      },

      skipToPrevious: async () => {
        try {
          await TrackPlayer.skipToPrevious();
          set({ error: null });
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to skip previous',
          });
        }
      },

      skipTo: async (index: number) => {
        try {
          await TrackPlayer.skip(index);
          set({ error: null });
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : 'Failed to skip',
          });
        }
      },

      seekTo: async (position: number) => {
        try {
          await TrackPlayer.seekTo(position);
          set({ error: null });
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : 'Failed to seek',
          });
        }
      },

      setRepeatMode: async (mode: RepeatMode) => {
        try {
          await TrackPlayer.setRepeatMode(mode);
          set({ repeatMode: mode, error: null });
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to set repeat mode',
          });
        }
      },

      setPlaybackRate: async (rate: number) => {
        try {
          await TrackPlayer.setRate(rate);
          set({ playbackRate: rate, error: null });
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : 'Failed to set rate',
          });
        }
      },

      setVolume: async (volume: number) => {
        try {
          await TrackPlayer.setVolume(volume);
          set({ volume, error: null });
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : 'Failed to set volume',
          });
        }
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
            (global as Record<string, unknown>).sleepTimerInterval as ReturnType<typeof setInterval>,
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
            (global as Record<string, unknown>).sleepTimerInterval as ReturnType<typeof setInterval>,
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

      syncWithTrackPlayer: async () => {
        try {
          const queue = await TrackPlayer.getQueue();
          const activeTrack = await TrackPlayer.getActiveTrack();
          const activeIndex = activeTrack
            ? queue.findIndex((t) => t.id === activeTrack.id)
            : null;
          const playbackState = await TrackPlayer.getPlaybackState();
          const repeatMode = await TrackPlayer.getRepeatMode();
          const volume = await TrackPlayer.getVolume();
          const rate = await TrackPlayer.getRate();

          set({
            queue: queue as QueueItem[],
            currentTrackIndex: activeIndex !== -1 ? activeIndex : null,
            currentTrack:
              activeIndex !== null && activeIndex !== -1
                ? (queue[activeIndex] as QueueItem)
                : null,
            playbackState: playbackState.state,
            repeatMode,
            volume,
            playbackRate: rate,
            isPlaying: playbackState.state === State.Playing,
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
        repeatMode: state.repeatMode,
        playbackRate: state.playbackRate,
        volume: state.volume,
        queue: state.queue,
        currentTrackIndex: state.currentTrackIndex,
      }),
    },
  ),
);
