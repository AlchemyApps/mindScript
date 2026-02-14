import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, checkTrackOwnership } from '../../utils';
import { createServerClient } from '@mindscript/auth/server';

/**
 * GET /api/tracks/[id]/activity - Get track activity log
 * Returns config summary, render history, and payment history.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const trackId = params.id;

    const { user, error: authError } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: authError || 'Authentication required' },
        { status: 401 }
      );
    }

    const { authorized, error: ownershipError } = await checkTrackOwnership(trackId, user.id);
    if (!authorized) {
      return NextResponse.json(
        { error: ownershipError || 'Not authorized' },
        { status: 403 }
      );
    }

    const supabase = await createServerClient();

    // Fetch track details
    const { data: track, error: trackError } = await supabase
      .from('tracks')
      .select('id, title, voice_config, music_config, frequency_config, output_config, edit_count, created_at, updated_at, status')
      .eq('id', trackId)
      .single();

    if (trackError || !track) {
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 }
      );
    }

    // Fetch render history from audio_job_queue
    const { data: renderJobs } = await supabase
      .from('audio_job_queue')
      .select('id, status, progress, created_at, updated_at')
      .eq('track_id', trackId)
      .order('created_at', { ascending: false });

    // Fetch payment history from purchases
    const { data: purchases } = await supabase
      .from('purchases')
      .select('id, amount, currency, status, metadata, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Filter purchases related to this track by metadata
    const trackPurchases = (purchases || []).filter((p) => {
      const meta = p.metadata as Record<string, unknown> | null;
      return meta && (meta.track_id === trackId || meta.trackId === trackId);
    });

    return NextResponse.json({
      track: {
        id: track.id,
        title: track.title,
        status: track.status,
        voiceConfig: track.voice_config,
        musicConfig: track.music_config,
        frequencyConfig: track.frequency_config,
        outputConfig: track.output_config,
        editCount: track.edit_count,
        createdAt: track.created_at,
        updatedAt: track.updated_at,
      },
      renderHistory: (renderJobs || []).map((job) => ({
        id: job.id,
        status: job.status,
        progress: job.progress,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
      })),
      payments: trackPurchases.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        type: (p.metadata as Record<string, unknown>)?.type || 'track_purchase',
        createdAt: p.created_at,
      })),
    });
  } catch (error) {
    console.error('[Activity API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
