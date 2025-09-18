import { create } from "zustand";

interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number;
  url: string;
}

interface AudioStore {
  currentTrack: Track | null;
  isPlaying: boolean;
  queue: Track[];
  volume: number;
  setCurrentTrack: (track: Track | null) => void;
  setIsPlaying: (playing: boolean) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (trackId: string) => void;
  setVolume: (volume: number) => void;
  clearQueue: () => void;
}

export const useAudioStore = create<AudioStore>((set) => ({
  currentTrack: null,
  isPlaying: false,
  queue: [],
  volume: 1,
  setCurrentTrack: (track) => set({ currentTrack: track }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  addToQueue: (track) =>
    set((state) => ({ queue: [...state.queue, track] })),
  removeFromQueue: (trackId) =>
    set((state) => ({
      queue: state.queue.filter((t) => t.id !== trackId),
    })),
  setVolume: (volume) => set({ volume }),
  clearQueue: () => set({ queue: [] }),
}));