import { supabase } from '../lib/supabase';

export interface LibraryTrack {
  id: string;
  title: string;
  description: string | null;
  status: string;
  audio_url: string | null;
  duration_seconds: number | null;
  cover_image_url: string | null;
  play_count: number;
  created_at: string;
  is_public: boolean;
  voice_config: Record<string, unknown>;
}

class TrackService {
  /**
   * Fetch user's library: owned tracks + purchased tracks.
   * Note: track_access.user_id is TEXT, not UUID — must cast.
   */
  async fetchUserLibrary(userId: string): Promise<LibraryTrack[]> {
    // Owned tracks
    const { data: ownedTracks, error: ownedError } = await supabase
      .from('tracks')
      .select(
        'id, title, description, status, audio_url, duration_seconds, cover_image_url, play_count, created_at, is_public, voice_config',
      )
      .eq('user_id', userId)
      .is('deleted_at', null)
      .in('status', ['published', 'draft'])
      .order('created_at', { ascending: false });

    if (ownedError) {
      console.error('Error fetching owned tracks:', ownedError);
      throw ownedError;
    }

    // Purchased tracks via track_access (user_id is TEXT)
    const { data: accessRows, error: accessError } = await supabase
      .from('track_access')
      .select('track_id')
      .eq('user_id', userId);

    if (accessError) {
      console.error('Error fetching track access:', accessError);
      // Non-fatal — return owned tracks only
      return (ownedTracks as LibraryTrack[]) ?? [];
    }

    const purchasedIds = (accessRows ?? [])
      .map((r) => r.track_id)
      .filter(
        (id) => !ownedTracks?.some((t) => t.id === id),
      );

    if (purchasedIds.length === 0) {
      return (ownedTracks as LibraryTrack[]) ?? [];
    }

    const { data: purchasedTracks, error: purchasedError } = await supabase
      .from('tracks')
      .select(
        'id, title, description, status, audio_url, duration_seconds, cover_image_url, play_count, created_at, is_public, voice_config',
      )
      .in('id', purchasedIds)
      .is('deleted_at', null)
      .eq('status', 'published');

    if (purchasedError) {
      console.error('Error fetching purchased tracks:', purchasedError);
      return (ownedTracks as LibraryTrack[]) ?? [];
    }

    return [
      ...((ownedTracks as LibraryTrack[]) ?? []),
      ...((purchasedTracks as LibraryTrack[]) ?? []),
    ];
  }

  /**
   * Get a signed URL for private audio file playback.
   * Returns null if the track has no audio_url.
   *
   * audio_url formats:
   * 1. Full Supabase URL: "https://xxx.supabase.co/storage/v1/object/sign/audio-renders/tracks/.../rendered.mp3?token=..."
   * 2. Storage path with bucket prefix: "audio-renders/tracks/.../rendered.mp3"
   * 3. Full external URL: "https://cdn.example.com/audio.mp3"
   */
  async getSignedAudioUrl(trackId: string): Promise<string | null> {
    const { data: track, error } = await supabase
      .from('tracks')
      .select('audio_url')
      .eq('id', trackId)
      .single();

    if (error || !track?.audio_url) {
      console.log('[TrackService] No audio_url for track', trackId, error);
      return null;
    }

    const audioUrl: string = track.audio_url;
    console.log('[TrackService] audio_url:', audioUrl);

    if (audioUrl.startsWith('http')) {
      // Full URL — try to extract bucket/path for re-signing
      try {
        const url = new URL(audioUrl);
        const pathMatch = url.pathname.match(
          /\/storage\/v1\/object\/(?:public|sign)\/([^?]+)/,
        );
        if (pathMatch) {
          const fullPath = decodeURIComponent(pathMatch[1]);
          const parts = fullPath.split('/');
          const bucket = parts[0];
          const storagePath = parts.slice(1).join('/');
          return this.signFromBucket(bucket, storagePath) ?? audioUrl;
        }
      } catch {
        // Can't parse — return original URL as-is
      }
      return audioUrl;
    }

    // Storage path with bucket prefix: "audio-renders/tracks/.../rendered.mp3"
    const parts = audioUrl.split('/');
    if (parts.length < 2) return null;

    const bucket = parts[0];
    const storagePath = parts.slice(1).join('/');
    return this.signFromBucket(bucket, storagePath);
  }

  private async signFromBucket(
    bucket: string,
    storagePath: string,
  ): Promise<string | null> {
    const { data, error: signError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 3600);

    if (signError) {
      console.warn(`[TrackService] Error signing from ${bucket}/${storagePath}:`, signError);
      return null;
    }

    console.log('[TrackService] Signed URL created from bucket:', bucket);
    return data?.signedUrl ?? null;
  }
}

export const trackService = new TrackService();
