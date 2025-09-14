import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export interface Track {
  id: string;
  title: string;
  artist?: string;
  url: string;
  duration: number;
  coverImage?: string;
  type?: 'owned' | 'purchased';
  status?: 'draft' | 'rendering' | 'published' | 'failed';
}

export type RepeatMode = 'none' | 'one' | 'all';

interface PlayerState {
  // Current track
  currentTrack: Track | null;
  
  // Playback state
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  
  // Volume
  volume: number;
  isMuted: boolean;
  
  // Queue
  queue: Track[];
  currentIndex: number;
  
  // Playback modes
  shuffleMode: boolean;
  repeatMode: RepeatMode;
  
  // UI states
  isLoading: boolean;
  error: string | null;
  
  // Shuffle history for maintaining order
  shuffleHistory?: number[];
  originalQueue?: Track[];
}

interface PlayerActions {
  // Track management
  setCurrentTrack: (track: Track) => void;
  clearCurrentTrack: () => void;
  
  // Playback controls
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  stop: () => void;
  
  // Time controls
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  seek: (time: number) => void;
  seekToPercentage: (percentage: number) => void;
  
  // Volume controls
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  
  // Queue management
  setQueue: (tracks: Track[], startIndex?: number) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setCurrentIndex: (index: number) => void;
  
  // Navigation
  playNext: () => void;
  playPrevious: () => void;
  playTrackAtIndex: (index: number) => void;
  
  // Playback modes
  setShuffleMode: (enabled: boolean) => void;
  toggleShuffle: () => void;
  setRepeatMode: (mode: RepeatMode) => void;
  toggleRepeat: () => void;
  
  // UI states
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

type PlayerStore = PlayerState & PlayerActions;

const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

export const usePlayerStore = create<PlayerStore>()(
  persist(
    immer((set, get) => ({
      // Initial state
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 1,
      isMuted: false,
      queue: [],
      currentIndex: -1,
      shuffleMode: false,
      repeatMode: 'none',
      isLoading: false,
      error: null,

      // Track management
      setCurrentTrack: (track) => set(state => {
        state.currentTrack = track;
        state.duration = track.duration;
        state.currentTime = 0;
        state.error = null;
      }),

      clearCurrentTrack: () => set(state => {
        state.currentTrack = null;
        state.isPlaying = false;
        state.currentTime = 0;
        state.duration = 0;
      }),

      // Playback controls
      play: () => set(state => {
        state.isPlaying = true;
      }),

      pause: () => set(state => {
        state.isPlaying = false;
      }),

      togglePlayPause: () => set(state => {
        state.isPlaying = !state.isPlaying;
      }),

      stop: () => set(state => {
        state.isPlaying = false;
        state.currentTime = 0;
      }),

      // Time controls
      setCurrentTime: (time) => set(state => {
        state.currentTime = time;
      }),

      setDuration: (duration) => set(state => {
        state.duration = duration;
      }),

      seek: (time) => set(state => {
        state.currentTime = clamp(time, 0, state.duration);
      }),

      seekToPercentage: (percentage) => set(state => {
        const time = state.duration * clamp(percentage, 0, 1);
        state.currentTime = time;
      }),

      // Volume controls
      setVolume: (volume) => set(state => {
        state.volume = clamp(volume, 0, 1);
      }),

      toggleMute: () => set(state => {
        state.isMuted = !state.isMuted;
      }),

      // Queue management
      setQueue: (tracks, startIndex = 0) => set(state => {
        state.originalQueue = tracks;
        
        if (state.shuffleMode && tracks.length > 1) {
          // Keep current track at the start if playing
          const currentTrack = tracks[startIndex];
          const otherTracks = tracks.filter((_, i) => i !== startIndex);
          const shuffled = shuffleArray(otherTracks);
          state.queue = [currentTrack, ...shuffled];
          state.currentIndex = 0;
        } else {
          state.queue = tracks;
          state.currentIndex = startIndex;
        }
        
        if (tracks.length > 0) {
          state.currentTrack = state.queue[state.currentIndex];
          state.duration = state.currentTrack.duration;
        }
      }),

      addToQueue: (track) => set(state => {
        state.queue.push(track);
        if (state.originalQueue) {
          state.originalQueue.push(track);
        }
        if (state.queue.length === 1) {
          state.currentIndex = 0;
          state.currentTrack = track;
          state.duration = track.duration;
        }
      }),

      removeFromQueue: (index) => set(state => {
        if (index < 0 || index >= state.queue.length) return;
        
        state.queue.splice(index, 1);
        
        // Adjust current index if needed
        if (index < state.currentIndex) {
          state.currentIndex--;
        } else if (index === state.currentIndex) {
          if (state.currentIndex >= state.queue.length && state.queue.length > 0) {
            state.currentIndex = state.queue.length - 1;
          }
          if (state.queue.length > 0) {
            state.currentTrack = state.queue[state.currentIndex];
            state.duration = state.currentTrack.duration;
            state.currentTime = 0;
          } else {
            state.currentTrack = null;
            state.currentIndex = -1;
            state.isPlaying = false;
          }
        }
      }),

      clearQueue: () => set(state => {
        state.queue = [];
        state.originalQueue = undefined;
        state.currentIndex = -1;
        state.currentTrack = null;
        state.isPlaying = false;
        state.currentTime = 0;
        state.duration = 0;
      }),

      setCurrentIndex: (index) => set(state => {
        if (index >= 0 && index < state.queue.length) {
          state.currentIndex = index;
          state.currentTrack = state.queue[index];
          state.duration = state.currentTrack.duration;
          state.currentTime = 0;
        }
      }),

      // Navigation
      playNext: () => set(state => {
        const { repeatMode, currentIndex, queue } = state;
        
        if (queue.length === 0) return;
        
        let nextIndex = currentIndex;
        
        if (repeatMode === 'one') {
          // Stay on current track
          state.currentTime = 0;
        } else if (currentIndex === queue.length - 1) {
          // At end of queue
          if (repeatMode === 'all') {
            nextIndex = 0;
          } else {
            // Stop playback at end
            state.isPlaying = false;
            return;
          }
        } else {
          nextIndex = currentIndex + 1;
        }
        
        state.currentIndex = nextIndex;
        state.currentTrack = queue[nextIndex];
        state.duration = state.currentTrack.duration;
        state.currentTime = 0;
      }),

      playPrevious: () => set(state => {
        const { currentIndex, queue, currentTime } = state;
        
        if (queue.length === 0) return;
        
        // If more than 3 seconds into track, restart current track
        if (currentTime > 3) {
          state.currentTime = 0;
          return;
        }
        
        let prevIndex = currentIndex;
        
        if (currentIndex === 0) {
          // At start of queue
          if (state.repeatMode === 'all') {
            prevIndex = queue.length - 1;
          } else {
            // Just restart current track
            state.currentTime = 0;
            return;
          }
        } else {
          prevIndex = currentIndex - 1;
        }
        
        state.currentIndex = prevIndex;
        state.currentTrack = queue[prevIndex];
        state.duration = state.currentTrack.duration;
        state.currentTime = 0;
      }),

      playTrackAtIndex: (index) => set(state => {
        if (index >= 0 && index < state.queue.length) {
          state.currentIndex = index;
          state.currentTrack = state.queue[index];
          state.duration = state.currentTrack.duration;
          state.currentTime = 0;
          state.isPlaying = true;
        }
      }),

      // Playback modes
      setShuffleMode: (enabled) => set(state => {
        state.shuffleMode = enabled;
        
        if (enabled && state.queue.length > 1) {
          // Save original order
          if (!state.originalQueue) {
            state.originalQueue = [...state.queue];
          }
          
          // Shuffle queue keeping current track at the front
          const currentTrack = state.currentTrack;
          const otherTracks = state.queue.filter(t => t.id !== currentTrack?.id);
          const shuffled = shuffleArray(otherTracks);
          
          if (currentTrack) {
            state.queue = [currentTrack, ...shuffled];
            state.currentIndex = 0;
          } else {
            state.queue = shuffled;
          }
        } else if (!enabled && state.originalQueue) {
          // Restore original order
          const currentTrack = state.currentTrack;
          state.queue = state.originalQueue;
          state.originalQueue = undefined;
          
          // Find current track in restored queue
          if (currentTrack) {
            const index = state.queue.findIndex(t => t.id === currentTrack.id);
            state.currentIndex = index >= 0 ? index : 0;
          }
        }
      }),

      toggleShuffle: () => {
        const { shuffleMode } = get();
        get().setShuffleMode(!shuffleMode);
      },

      setRepeatMode: (mode) => set(state => {
        state.repeatMode = mode;
      }),

      toggleRepeat: () => set(state => {
        const modes: RepeatMode[] = ['none', 'all', 'one'];
        const currentIndex = modes.indexOf(state.repeatMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        state.repeatMode = modes[nextIndex];
      }),

      // UI states
      setIsLoading: (loading) => set(state => {
        state.isLoading = loading;
      }),

      setError: (error) => set(state => {
        state.error = error;
      }),

      clearError: () => set(state => {
        state.error = null;
      }),
    })),
    {
      name: 'mindscript-player',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        volume: state.volume,
        isMuted: state.isMuted,
        shuffleMode: state.shuffleMode,
        repeatMode: state.repeatMode,
      }),
    }
  )
);