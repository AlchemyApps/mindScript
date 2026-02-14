import { getSupabaseBrowserClient } from '@mindscript/auth/client';

type PlaybackEventType = 'play' | 'pause' | 'resume' | 'complete' | 'skip' | 'seek';

interface PlaybackEventPayload {
  trackId: string;
  eventType: PlaybackEventType;
  durationListenedSeconds?: number;
  totalTrackDurationSeconds?: number;
  positionSeconds?: number;
}

// One session ID per browser tab
function getSessionId(): string {
  let sessionId = sessionStorage.getItem('mindscript_playback_session');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('mindscript_playback_session', sessionId);
  }
  return sessionId;
}

export async function trackPlaybackEvent(
  userId: string,
  event: PlaybackEventPayload
): Promise<void> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from('playback_events').insert({
      user_id: userId,
      track_id: event.trackId,
      event_type: event.eventType,
      duration_listened_seconds: event.durationListenedSeconds ?? 0,
      total_track_duration_seconds: event.totalTrackDurationSeconds ?? 0,
      position_seconds: event.positionSeconds ?? 0,
      platform: 'web',
      device_info: { browser: navigator.userAgent },
      session_id: getSessionId(),
    });
    if (error) {
      console.warn('[playback-analytics] Failed to track event:', error.message);
    }
  } catch (e) {
    console.warn('[playback-analytics] Error tracking playback event:', e);
  }
}

export async function incrementPlayCount(trackId: string): Promise<void> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc('increment_play_count', {
      p_track_id: trackId,
    });
    if (error) {
      console.warn('[playback-analytics] Failed to increment play count:', error.message);
    }
  } catch (e) {
    console.warn('[playback-analytics] Error incrementing play count:', e);
  }
}
