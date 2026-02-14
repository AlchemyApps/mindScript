import { supabase } from '../lib/supabase';

export interface SupabasePlaylist {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupabasePlaylistTrack {
  id: string;
  playlist_id: string;
  track_id: string;
  position: number;
  added_at: string;
  added_by: string;
}

class PlaylistService {
  async fetchPlaylists(userId: string): Promise<SupabasePlaylist[]> {
    const { data, error } = await supabase
      .from('playlists')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[PlaylistService] fetchPlaylists error:', error);
      throw error;
    }

    return (data as SupabasePlaylist[]) ?? [];
  }

  async fetchPlaylistTracks(playlistId: string): Promise<SupabasePlaylistTrack[]> {
    const { data, error } = await supabase
      .from('playlist_tracks')
      .select('*')
      .eq('playlist_id', playlistId)
      .order('position', { ascending: true });

    if (error) {
      console.error('[PlaylistService] fetchPlaylistTracks error:', error);
      throw error;
    }

    return (data as SupabasePlaylistTrack[]) ?? [];
  }

  async createPlaylist(
    userId: string,
    title: string,
    description?: string,
  ): Promise<SupabasePlaylist> {
    const { data, error } = await supabase
      .from('playlists')
      .insert({
        user_id: userId,
        title,
        description: description ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('[PlaylistService] createPlaylist error:', error);
      throw error;
    }

    return data as SupabasePlaylist;
  }

  async updatePlaylist(
    playlistId: string,
    updates: { title?: string; description?: string },
  ): Promise<void> {
    const { error } = await supabase
      .from('playlists')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', playlistId);

    if (error) {
      console.error('[PlaylistService] updatePlaylist error:', error);
      throw error;
    }
  }

  async deletePlaylist(playlistId: string): Promise<void> {
    const { error } = await supabase
      .from('playlists')
      .delete()
      .eq('id', playlistId);

    if (error) {
      console.error('[PlaylistService] deletePlaylist error:', error);
      throw error;
    }
  }

  async addTrackToPlaylist(playlistId: string, trackId: string): Promise<void> {
    const { error } = await supabase.rpc('add_track_to_playlist', {
      p_playlist_id: playlistId,
      p_track_id: trackId,
    });

    if (error) {
      console.error('[PlaylistService] addTrackToPlaylist error:', error);
      throw error;
    }
  }

  async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
    const { error } = await supabase
      .from('playlist_tracks')
      .delete()
      .eq('playlist_id', playlistId)
      .eq('track_id', trackId);

    if (error) {
      console.error('[PlaylistService] removeTrackFromPlaylist error:', error);
      throw error;
    }
  }

  async reorderTrack(
    playlistId: string,
    trackId: string,
    newPosition: number,
  ): Promise<void> {
    const { error } = await supabase.rpc('reorder_playlist_tracks', {
      p_playlist_id: playlistId,
      p_track_id: trackId,
      p_new_position: newPosition,
    });

    if (error) {
      console.error('[PlaylistService] reorderTrack error:', error);
      throw error;
    }
  }

  async syncPlaylistTracks(
    playlistId: string,
    trackIds: string[],
    userId: string,
  ): Promise<void> {
    // Delete existing tracks
    await supabase
      .from('playlist_tracks')
      .delete()
      .eq('playlist_id', playlistId);

    if (trackIds.length === 0) return;

    // Insert in order
    const rows = trackIds.map((trackId, position) => ({
      playlist_id: playlistId,
      track_id: trackId,
      position,
      added_by: userId,
    }));

    const { error } = await supabase
      .from('playlist_tracks')
      .insert(rows);

    if (error) {
      console.error('[PlaylistService] syncPlaylistTracks error:', error);
      throw error;
    }
  }
}

export const playlistService = new PlaylistService();
