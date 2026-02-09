import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DownloadStatus =
  | 'idle'
  | 'queued'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface DownloadState {
  status: DownloadStatus;
  progress: number; // 0-100
  localUri: string | null;
  error: string | null;
  fileSize: number | null;
  downloadedAt: number | null;
}

interface DownloadStoreState {
  downloads: Record<string, DownloadState>;

  getDownload: (trackId: string) => DownloadState;
  setQueued: (trackId: string) => void;
  setDownloading: (trackId: string, progress: number) => void;
  setDownloaded: (trackId: string, localUri: string, fileSize: number) => void;
  setError: (trackId: string, error: string) => void;
  removeDownload: (trackId: string) => void;
  isDownloaded: (trackId: string) => boolean;
  getLocalUri: (trackId: string) => string | null;
  getDownloadedTrackIds: () => string[];
  getTotalCacheSize: () => number;
}

const DEFAULT_STATE: DownloadState = {
  status: 'idle',
  progress: 0,
  localUri: null,
  error: null,
  fileSize: null,
  downloadedAt: null,
};

export const useDownloadStore = create<DownloadStoreState>()(
  persist(
    (set, get) => ({
      downloads: {},

      getDownload: (trackId: string): DownloadState => {
        return get().downloads[trackId] ?? DEFAULT_STATE;
      },

      setQueued: (trackId: string) => {
        set((state) => ({
          downloads: {
            ...state.downloads,
            [trackId]: {
              ...DEFAULT_STATE,
              status: 'queued',
            },
          },
        }));
      },

      setDownloading: (trackId: string, progress: number) => {
        set((state) => ({
          downloads: {
            ...state.downloads,
            [trackId]: {
              ...state.downloads[trackId],
              status: 'downloading',
              progress,
              error: null,
            },
          },
        }));
      },

      setDownloaded: (
        trackId: string,
        localUri: string,
        fileSize: number,
      ) => {
        set((state) => ({
          downloads: {
            ...state.downloads,
            [trackId]: {
              status: 'downloaded',
              progress: 100,
              localUri,
              error: null,
              fileSize,
              downloadedAt: Date.now(),
            },
          },
        }));
      },

      setError: (trackId: string, error: string) => {
        set((state) => ({
          downloads: {
            ...state.downloads,
            [trackId]: {
              ...state.downloads[trackId],
              status: 'error',
              progress: 0,
              error,
            },
          },
        }));
      },

      removeDownload: (trackId: string) => {
        set((state) => {
          const { [trackId]: _, ...rest } = state.downloads;
          return { downloads: rest };
        });
      },

      isDownloaded: (trackId: string): boolean => {
        return get().downloads[trackId]?.status === 'downloaded';
      },

      getLocalUri: (trackId: string): string | null => {
        const dl = get().downloads[trackId];
        return dl?.status === 'downloaded' ? dl.localUri : null;
      },

      getDownloadedTrackIds: (): string[] => {
        return Object.entries(get().downloads)
          .filter(([, dl]) => dl.status === 'downloaded')
          .map(([id]) => id);
      },

      getTotalCacheSize: (): number => {
        return Object.values(get().downloads).reduce(
          (sum, dl) =>
            dl.status === 'downloaded' ? sum + (dl.fileSize ?? 0) : sum,
          0,
        );
      },
    }),
    {
      name: 'download-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        downloads: Object.fromEntries(
          Object.entries(state.downloads).filter(
            ([, dl]) => dl.status === 'downloaded',
          ),
        ),
      }),
    },
  ),
);
