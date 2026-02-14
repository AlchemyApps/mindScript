import { Platform } from 'react-native';
import { supabase } from './supabase';

type EventType = 'play' | 'pause' | 'resume' | 'complete' | 'skip' | 'seek';

interface PlaybackEvent {
  trackId: string;
  eventType: EventType;
  durationListenedSeconds?: number;
  totalTrackDurationSeconds?: number;
  positionSeconds?: number;
  sessionId?: string;
}

let currentSessionId: string | null = null;

function generateSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getSessionId(): string {
  if (!currentSessionId) {
    currentSessionId = generateSessionId();
  }
  return currentSessionId;
}

export function resetSession(): void {
  currentSessionId = null;
}

function getPlatform(): 'mobile_ios' | 'mobile_android' {
  return Platform.OS === 'ios' ? 'mobile_ios' : 'mobile_android';
}

export async function trackPlaybackEvent(
  userId: string,
  event: PlaybackEvent,
): Promise<void> {
  try {
    const { error } = await supabase.from('playback_events').insert({
      user_id: userId,
      track_id: event.trackId,
      event_type: event.eventType,
      duration_listened_seconds: event.durationListenedSeconds ?? 0,
      total_track_duration_seconds: event.totalTrackDurationSeconds,
      platform: getPlatform(),
      device_info: {
        os: Platform.OS,
        version: Platform.Version,
      },
      session_id: event.sessionId ?? getSessionId(),
      position_seconds: event.positionSeconds ?? 0,
    });

    if (error) {
      console.warn('[analytics] Failed to track event:', error.message);
    }
  } catch (e) {
    // Never throw — analytics failures must not break playback
    console.warn('[analytics] Error tracking playback event:', e);
  }
}

export async function incrementPlayCount(trackId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('increment_play_count', {
      p_track_id: trackId,
    });
    if (error) {
      console.warn('[analytics] Failed to increment play count:', error.message);
    }
  } catch (e) {
    console.warn('[analytics] Error incrementing play count:', e);
  }
}
