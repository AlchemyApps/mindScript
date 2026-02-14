import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { playlistService } from '../services/playlistService';
import { trackService } from '../services/trackService';
import { downloadService } from '../services/downloadService';
import { usePlayerStore, QueueItem } from './playerStore';

export interface Playlist {
  id: string;
  title: string;
  description?: string;
  trackIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface PlaylistState {
  playlists: Playlist[];
  loading: boolean;
  error: string | null;

  createPlaylist: (title: string, userId: string) => Promise<Playlist>;
  deletePlaylist: (id: string) => Promise<void>;
  updatePlaylistTitle: (id: string, title: string) => Promise<void>;
  addTrackToPlaylist: (playlistId: string, trackId: string, userId: string) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  reorderTracks: (playlistId: string, trackIds: string[]) => void;
  playPlaylist: (playlistId: string) => Promise<void>;
  syncFromSupabase: (userId: string) => Promise<void>;
  clearError: () => void;
}

export const usePlaylistStore = create<PlaylistState>()(
  persist(
    (set, get) => ({
      playlists: [],
      loading: false,
      error: null,

      createPlaylist: async (title: string, userId: string) => {
        const now = new Date().toISOString();
        let playlist: Playlist;

        try {
          // Create in Supabase first to get a real UUID
          const remote = await playlistService.createPlaylist(userId, title);
          playlist = {
            id: remote.id,
            title: remote.title,
            description: remote.description ?? undefined,
            trackIds: [],
            createdAt: remote.created_at,
            updatedAt: remote.updated_at,
          };
        } catch (err) {
          console.warn('[PlaylistStore] Supabase create failed, creating locally:', err);
          // Fallback: create locally with a temp ID
          playlist = {
            id: `local_${Date.now()}`,
            title,
            trackIds: [],
            createdAt: now,
            updatedAt: now,
          };
        }

        set((state) => ({
          playlists: [playlist, ...state.playlists],
          error: null,
        }));

        return playlist;
      },

      deletePlaylist: async (id: string) => {
        set((state) => ({
          playlists: state.playlists.filter((p) => p.id !== id),
          error: null,
        }));

        // Sync delete to Supabase in background
        if (!id.startsWith('local_')) {
          playlistService.deletePlaylist(id).catch((err) => {
            console.warn('[PlaylistStore] Supabase delete failed:', err);
          });
        }
      },

      updatePlaylistTitle: async (id: string, title: string) => {
        const now = new Date().toISOString();
        set((state) => ({
          playlists: state.playlists.map((p) =>
            p.id === id ? { ...p, title, updatedAt: now } : p,
          ),
          error: null,
        }));

        if (!id.startsWith('local_')) {
          playlistService.updatePlaylist(id, { title }).catch((err) => {
            console.warn('[PlaylistStore] Supabase update failed:', err);
          });
        }
      },

      addTrackToPlaylist: async (playlistId: string, trackId: string, userId: string) => {
        const playlist = get().playlists.find((p) => p.id === playlistId);
        if (!playlist) return;
        if (playlist.trackIds.includes(trackId)) return;

        const now = new Date().toISOString();
        set((state) => ({
          playlists: state.playlists.map((p) =>
            p.id === playlistId
              ? { ...p, trackIds: [...p.trackIds, trackId], updatedAt: now }
              : p,
          ),
          error: null,
        }));

        // Sync to Supabase
        if (!playlistId.startsWith('local_')) {
          playlistService.addTrackToPlaylist(playlistId, trackId).catch((err) => {
            console.warn('[PlaylistStore] Supabase addTrack failed:', err);
          });
        }
      },

      removeTrackFromPlaylist: async (playlistId: string, trackId: string) => {
        const now = new Date().toISOString();
        set((state) => ({
          playlists: state.playlists.map((p) =>
            p.id === playlistId
              ? {
                  ...p,
                  trackIds: p.trackIds.filter((id) => id !== trackId),
                  updatedAt: now,
                }
              : p,
          ),
          error: null,
        }));

        if (!playlistId.startsWith('local_')) {
          playlistService.removeTrackFromPlaylist(playlistId, trackId).catch((err) => {
            console.warn('[PlaylistStore] Supabase removeTrack failed:', err);
          });
        }
      },

      reorderTracks: (playlistId: string, trackIds: string[]) => {
        const now = new Date().toISOString();
        set((state) => ({
          playlists: state.playlists.map((p) =>
            p.id === playlistId ? { ...p, trackIds, updatedAt: now } : p,
          ),
        }));
      },

      playPlaylist: async (playlistId: string) => {
        const playlist = get().playlists.find((p) => p.id === playlistId);
        if (!playlist || playlist.trackIds.length === 0) return;

        set({ loading: true, error: null });

        try {
          const queueItems: QueueItem[] = [];

          for (const trackId of playlist.trackIds) {
            const localUri = downloadService.getLocalAudioUri(trackId);
            let audioUrl = localUri;

            if (!audioUrl) {
              audioUrl = await trackService.getSignedAudioUrl(trackId);
            }

            if (!audioUrl) continue;

            // Fetch track metadata
            const { data: track } = await (await import('../lib/supabase')).supabase
              .from('tracks')
              .select('id, title, cover_image_url, duration_seconds')
              .eq('id', trackId)
              .single();

            queueItems.push({
              id: trackId,
              url: audioUrl,
              title: track?.title ?? 'Unknown',
              artist: 'MindScript',
              artwork: track?.cover_image_url ?? undefined,
              duration: track?.duration_seconds ?? 0,
              mindscriptId: trackId,
              isDownloaded: !!localUri,
              localPath: localUri ?? undefined,
            });
          }

          if (queueItems.length > 0) {
            usePlayerStore.getState().setQueue(queueItems);
          }
        } catch (err) {
          console.error('[PlaylistStore] playPlaylist error:', err);
          set({ error: 'Failed to load playlist tracks' });
        } finally {
          set({ loading: false });
        }
      },

      syncFromSupabase: async (userId: string) => {
        set({ loading: true, error: null });
        try {
          const remotePlaylists = await playlistService.fetchPlaylists(userId);

          const playlists: Playlist[] = [];
          for (const remote of remotePlaylists) {
            const tracks = await playlistService.fetchPlaylistTracks(remote.id);
            playlists.push({
              id: remote.id,
              title: remote.title,
              description: remote.description ?? undefined,
              trackIds: tracks.map((t) => t.track_id),
              createdAt: remote.created_at,
              updatedAt: remote.updated_at,
            });
          }

          // Merge: keep local-only playlists, replace remote ones
          const localOnly = get().playlists.filter((p) => p.id.startsWith('local_'));
          set({ playlists: [...playlists, ...localOnly], loading: false });
        } catch (err) {
          console.error('[PlaylistStore] syncFromSupabase error:', err);
          set({ error: 'Failed to sync playlists', loading: false });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'playlist-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        playlists: state.playlists,
      }),
    },
  ),
);
