import { createServerClient } from '@mindscript/auth/server';
import type { ListTracksQuery, Track } from '@mindscript/schemas';

/**
 * Get authenticated user from Supabase
 */
export async function getAuthenticatedUser() {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return { user: null, error: error?.message || 'Unauthorized' };
  }
  
  return { user, error: null };
}

/**
 * Check if user owns a track
 */
export async function checkTrackOwnership(trackId: string, userId: string) {
  const supabase = await createServerClient();
  
  const { data: tracks, error } = await supabase
    .from('tracks')
    .select('user_id')
    .eq('id', trackId)
    .is('deleted_at', null);
  
  if (error) {
    return { authorized: false, error: error.message };
  }
  
  if (!tracks || tracks.length === 0) {
    return { authorized: false, error: 'Track not found' };
  }
  
  const track = tracks[0];
  if (track.user_id !== userId) {
    return { authorized: false, error: 'Permission denied' };
  }
  
  return { authorized: true, error: null };
}

/**
 * Check if user can access a track (owner or public)
 */
export async function checkTrackAccess(trackId: string, userId?: string) {
  const supabase = await createServerClient();
  
  const { data: track, error } = await supabase
    .from('tracks')
    .select(`
      id,
      user_id,
      is_public,
      status,
      profiles!tracks_user_id_fkey (
        id,
        display_name,
        avatar_url
      )
    `)
    .eq('id', trackId)
    .is('deleted_at', null)
    .single();
  
  if (error || !track) {
    return { track: null, authorized: false, error: 'Track not found' };
  }
  
  // Owner can always access
  if (userId && track.user_id === userId) {
    return { track, authorized: true, error: null };
  }
  
  // Non-owners can only access public tracks
  if (track.is_public) {
    return { track, authorized: true, error: null };
  }
  
  return { track: null, authorized: false, error: 'Access denied' };
}

/**
 * Build track query with filters and pagination
 */
export function buildTrackQuery(supabase: any, params: ListTracksQuery, userId?: string) {
  let query = supabase
    .from('tracks')
    .select(`
      *,
      profiles!tracks_user_id_fkey (
        id,
        display_name,
        avatar_url
      ),
      renders!tracks_render_job_id_fkey (
        id,
        status
      )
    `)
    .is('deleted_at', null);

  // Filter by owner if provided
  if (params.owner_id) {
    query = query.eq('user_id', params.owner_id);
  } else if (userId && !params.is_public) {
    // If no owner_id specified and not explicitly requesting public tracks,
    // show user's own tracks
    query = query.eq('user_id', userId);
  }

  // Filter by status
  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status);
  }

  // Filter by public status
  if (params.is_public !== undefined) {
    query = query.eq('is_public', params.is_public);
  }

  // Filter by tags
  if (params.tags && params.tags.length > 0) {
    query = query.overlaps('tags', params.tags);
  }

  // Cursor-based pagination
  if (params.cursor) {
    const direction = params.order === 'desc' ? 'lt' : 'gt';
    query = query[direction]('created_at', params.cursor);
  }

  // Sorting
  const sortColumn = params.sort || 'created_at';
  const sortOrder = params.order || 'desc';
  query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

  // Limit
  query = query.limit(params.limit);

  return query;
}

/**
 * Transform database track to API response format
 */
export function transformTrackForResponse(dbTrack: any) {
  const track = {
    ...dbTrack,
    owner: dbTrack.profiles ? {
      id: dbTrack.profiles.id,
      display_name: dbTrack.profiles.display_name,
      avatar_url: dbTrack.profiles.avatar_url,
    } : undefined,
    render_status: dbTrack.renders?.status || null,
  };

  // Remove the joined data to clean up response
  delete track.profiles;
  delete track.renders;

  return track;
}

/**
 * Generate cursor for pagination
 */
export function generateCursor(track: Track): string {
  // Using createdAt as cursor
  return track.createdAt;
}

/**
 * Delete associated files from storage
 */
export async function deleteTrackFiles(track: Track) {
  const supabase = await createServerClient();
  const filesToDelete: string[] = [];

  // Extract file paths from URLs
  if (track.audio_url) {
    const urlParts = track.audio_url.split('/');
    const fileName = urlParts[urlParts.length - 1];
    if (fileName) {
      filesToDelete.push(fileName);
    }
  }

  if (filesToDelete.length > 0) {
    const { error } = await supabase.storage
      .from('audio-files')
      .remove(filesToDelete);

    if (error) {
      console.error('Error deleting files:', error);
      return { success: false, error: error.message };
    }
  }

  return { success: true, error: null };
}

/**
 * Validate track configuration
 */
export function validateTrackConfiguration(trackData: any) {
  // Business rule validations beyond Zod schema
  const errors: string[] = [];

  // Check if binaural config requires stereo
  if (trackData.frequency_config?.binaural?.enabled) {
    if (trackData.output_config?.format === 'wav' && trackData.output_config?.channels === 1) {
      errors.push('Binaural beats require stereo output');
    }
  }

  // Check script length limits for different TTS providers
  const scriptLength = trackData.script?.length || 0;
  if (trackData.voice_config?.provider === 'elevenlabs' && scriptLength > 2500) {
    errors.push('Script too long for ElevenLabs TTS (max 2500 characters)');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Rate limiting check (simple implementation)
 */
export async function checkRateLimit(userId: string, action: string) {
  // This is a simplified rate limiting implementation
  // In production, you'd use Redis or a proper rate limiting service
  
  const supabase = await createServerClient();
  
  // Check recent creations in the last hour
  if (action === 'create') {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: recentTracks, error } = await supabase
      .from('tracks')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo);

    if (error) {
      return { allowed: true, error: null }; // Allow on error to avoid blocking users
    }

    // Allow up to 10 tracks per hour
    if (recentTracks && recentTracks.length >= 10) {
      return { allowed: false, error: 'Rate limit exceeded. Please try again later.' };
    }
  }

  return { allowed: true, error: null };
}