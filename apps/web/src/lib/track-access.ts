import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@mindscript/auth/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface TrackAccessCheck {
  hasAccess: boolean;
  accessType: 'owner' | 'purchased' | 'none';
  track: any | null;
}

/**
 * Check if a user has access to a track (either as owner or purchaser)
 */
export async function checkTrackAccess(
  trackId: string,
  userId: string,
  supabase?: SupabaseClient
): Promise<TrackAccessCheck> {
  const client = supabase || await createClient();

  // First, check if the user owns the track
  const { data: track, error: trackError } = await client
    .from('tracks')
    .select('*')
    .eq('id', trackId)
    .single();

  if (trackError || !track) {
    return { hasAccess: false, accessType: 'none', track: null };
  }

  // Check if user is the owner
  if (track.user_id === userId) {
    return { hasAccess: true, accessType: 'owner', track };
  }

  // Check if user has purchased access
  const { data: access, error: accessError } = await client
    .from('track_access')
    .select('*')
    .eq('track_id', trackId)
    .eq('user_id', userId)
    .eq('access_type', 'purchase')
    .single();

  if (!accessError && access) {
    return { hasAccess: true, accessType: 'purchased', track };
  }

  return { hasAccess: false, accessType: 'none', track: null };
}

/**
 * Generate a signed URL for audio file access
 * @param audioUrl - The storage path of the audio file
 * @param expiresIn - Seconds until the URL expires (default: 3600 = 1 hour)
 */
export async function generateSignedUrl(
  audioUrl: string,
  expiresIn: number = 3600,
  _supabase?: SupabaseClient
): Promise<{ signedUrl: string | null; error: Error | null }> {
  // Always use admin client — audio-renders is a private bucket with no RLS policies,
  // so user-scoped clients get 400 on createSignedUrl
  const client = createServiceRoleClient();

  // Extract bucket and path from the audio URL
  // The URL can be either:
  // 1. A simple storage path: "audio-renders/tracks/.../rendered.mp3"
  // 2. A full Supabase signed URL: "https://xxx.supabase.co/storage/v1/object/sign/audio-renders/tracks/.../rendered.mp3?token=..."
  // 3. A full Supabase public URL: "https://xxx.supabase.co/storage/v1/object/public/audio-renders/tracks/.../rendered.mp3"
  let bucket: string;
  let storagePath: string;

  if (audioUrl.startsWith('http')) {
    // Full URL — extract the storage path from it
    try {
      const url = new URL(audioUrl);
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/([^?]+)/);
      if (pathMatch) {
        const fullPath = decodeURIComponent(pathMatch[1]);
        const parts = fullPath.split('/');
        bucket = parts[0];
        storagePath = parts.slice(1).join('/');
      } else {
        // Can't parse — return the original URL as-is (it's already signed)
        return { signedUrl: audioUrl, error: null };
      }
    } catch {
      return { signedUrl: audioUrl, error: null };
    }
  } else {
    // Simple storage path
    const parts = audioUrl.split('/');
    bucket = parts[0];
    storagePath = parts.slice(1).join('/');
  }

  try {
    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      console.error('Error generating signed URL:', error);
      // Fall back to original URL if it looks like it might work
      if (audioUrl.startsWith('http')) {
        return { signedUrl: audioUrl, error: null };
      }
      return { signedUrl: null, error };
    }

    return { signedUrl: data.signedUrl, error: null };
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return { signedUrl: null, error: error as Error };
  }
}

/**
 * Batch check access for multiple tracks
 * Useful for library views to avoid N+1 queries
 */
export async function batchCheckTrackAccess(
  trackIds: string[],
  userId: string,
  supabase?: SupabaseClient
): Promise<Map<string, boolean>> {
  const client = supabase || await createClient();
  const accessMap = new Map<string, boolean>();

  // Get all tracks to check ownership
  const { data: tracks } = await client
    .from('tracks')
    .select('id, user_id')
    .in('id', trackIds);

  // Get all purchased access
  const { data: purchases } = await client
    .from('track_access')
    .select('track_id')
    .in('track_id', trackIds)
    .eq('user_id', userId)
    .eq('access_type', 'purchase');

  // Build access map
  trackIds.forEach(trackId => {
    const track = tracks?.find(t => t.id === trackId);
    const hasPurchase = purchases?.some(p => p.track_id === trackId);

    accessMap.set(trackId, !!(track?.user_id === userId || hasPurchase));
  });

  return accessMap;
}

/**
 * Grant track access to a user (typically after purchase)
 */
export async function grantTrackAccess(
  trackId: string,
  userId: string,
  accessType: 'purchase' | 'gift' = 'purchase',
  purchaseId?: string,
  supabase?: SupabaseClient
): Promise<{ success: boolean; error: Error | null }> {
  const client = supabase || await createClient();

  try {
    const { error } = await client
      .from('track_access')
      .insert({
        track_id: trackId,
        user_id: userId,
        access_type: accessType,
        purchase_id: purchaseId,
        granted_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error granting track access:', error);
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Error granting track access:', error);
    return { success: false, error: error as Error };
  }
}