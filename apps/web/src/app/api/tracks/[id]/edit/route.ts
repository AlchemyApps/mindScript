import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@mindscript/auth/server';
import { z } from 'zod';
import { serverSupabase } from '@/lib/supabase/server';

const supabaseAdmin = createServiceRoleClient();

const EditRequestSchema = z.object({
  gains: z.object({
    voiceDb: z.number().min(-12).max(3),
    musicDb: z.number().min(-24).max(0),
    solfeggioDb: z.number().min(-30).max(-6),
    binauralDb: z.number().min(-30).max(-6),
  }),
  voiceSpeed: z.number().min(0.5).max(1.5).optional(),
  startDelaySec: z.number().int().min(0).max(300).optional(),
  // Optional feature changes
  solfeggio: z.object({
    enabled: z.boolean(),
    frequency: z.number().optional(),
  }).optional(),
  binaural: z.object({
    enabled: z.boolean(),
    band: z.enum(['delta', 'theta', 'alpha', 'beta', 'gamma']).optional(),
  }).optional(),
  duration: z.number().min(5).max(15).optional(),
  loop: z.object({
    enabled: z.boolean(),
    pause_seconds: z.number().min(1).max(30),
  }).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: trackId } = await params;

  // Authenticate via cookie-based session
  const supabase = await serverSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = user.id;

  try {
    const body = await request.json();
    const validation = EditRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid edit data', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const editData = validation.data;

    // Fetch track with ownership check
    const { data: track, error: trackError } = await supabaseAdmin
      .from('tracks')
      .select('*')
      .eq('id', trackId)
      .eq('user_id', userId)
      .single();

    if (trackError || !track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    // Check edit eligibility
    const { data: settings } = await supabaseAdmin
      .from('admin_settings')
      .select('key, value')
      .in('key', ['edit_fee_cents', 'free_edit_limit']);

    const freeEditLimit = Number(settings?.find(s => s.key === 'free_edit_limit')?.value ?? 3);
    const editCount = track.edit_count || 0;

    if (editCount >= freeEditLimit) {
      // Payment required - check if payment was made
      const paymentToken = request.headers.get('x-edit-payment-token');
      if (!paymentToken) {
        return NextResponse.json(
          { error: 'Payment required for this edit', requiresPayment: true },
          { status: 402 }
        );
      }
      // TODO: Verify payment token from Stripe session
    }

    // Save original config on first edit
    const originalConfig = track.original_config || {
      voice_config: track.voice_config,
      music_config: track.music_config,
      frequency_config: track.frequency_config,
      output_config: track.output_config,
    };

    // Build updated track config for re-render
    const updatedFrequencyConfig = {
      solfeggio: editData.solfeggio?.enabled ? {
        enabled: true,
        frequency: editData.solfeggio.frequency || track.frequency_config?.solfeggio?.frequency || track.frequency_config?.solfeggio?.hz || 528,
        volume_db: editData.gains.solfeggioDb,
      } : null,
      binaural: editData.binaural?.enabled ? {
        enabled: true,
        band: editData.binaural.band || track.frequency_config?.binaural?.band || 'alpha',
        volume_db: editData.gains.binauralDb,
      } : null,
    };

    const updatedOutputConfig = {
      ...track.output_config,
      durationMin: editData.duration || track.output_config?.durationMin || 10,
      loop: editData.loop || track.output_config?.loop || { enabled: true, pause_seconds: 5 },
    };

    // Update music config with new volume
    const updatedMusicConfig = track.music_config ? {
      ...track.music_config,
      volume_db: editData.gains.musicDb,
    } : null;

    // Update voice config with new speed if provided
    const updatedVoiceConfig = editData.voiceSpeed != null && track.voice_config ? {
      ...track.voice_config,
      settings: {
        ...track.voice_config.settings,
        speed: editData.voiceSpeed,
      },
    } : track.voice_config;

    // Update start delay if provided
    const startDelaySec = editData.startDelaySec ?? track.start_delay_seconds ?? 3;

    // Update track record — set status to 'draft' to indicate re-render in progress
    const { error: updateError } = await supabaseAdmin
      .from('tracks')
      .update({
        edit_count: editCount + 1,
        original_config: originalConfig,
        voice_config: updatedVoiceConfig,
        frequency_config: updatedFrequencyConfig,
        output_config: updatedOutputConfig,
        music_config: updatedMusicConfig,
        start_delay_seconds: startDelaySec,
        status: 'draft',
        updated_at: new Date().toISOString(),
      })
      .eq('id', trackId);

    if (updateError) {
      console.error('[EDIT] Failed to update track:', updateError);
      return NextResponse.json({ error: 'Failed to update track' }, { status: 500 });
    }

    // Build worker payload for re-render
    const workerPayload = {
      script: track.script || '',
      voice: track.voice_config ? {
        provider: track.voice_config.provider || 'openai',
        id: track.voice_config.voice_id || 'nova',
        model: track.voice_config.model || 'tts-1',
        speed: editData.voiceSpeed ?? track.voice_config.settings?.speed ?? 1.0,
      } : null,
      durationMin: updatedOutputConfig.durationMin,
      pauseSec: updatedOutputConfig.loop?.pause_seconds ?? 5,
      loopMode: updatedOutputConfig.loop?.enabled ?? true,
      startDelaySec,
      backgroundMusic: updatedMusicConfig ? {
        id: updatedMusicConfig.id,
        name: updatedMusicConfig.name,
        url: updatedMusicConfig.url,
      } : null,
      solfeggio: updatedFrequencyConfig.solfeggio?.enabled ? {
        enabled: true,
        hz: updatedFrequencyConfig.solfeggio.frequency,
        volume_db: editData.gains.solfeggioDb,
      } : null,
      binaural: updatedFrequencyConfig.binaural?.enabled ? {
        enabled: true,
        band: updatedFrequencyConfig.binaural.band,
        volume_db: editData.gains.binauralDb,
      } : null,
      gains: editData.gains,
    };

    // Enqueue re-render job
    const { data: job, error: jobError } = await supabaseAdmin
      .from('audio_job_queue')
      .insert({
        track_id: trackId,
        user_id: userId,
        status: 'pending',
        payload: workerPayload,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (jobError) {
      console.error('[EDIT] Failed to enqueue re-render job:', jobError);
      return NextResponse.json({ error: 'Failed to queue re-render' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      trackId,
      jobId: job?.id,
      editCount: editCount + 1,
      message: 'Track edit submitted. Re-rendering in progress.',
    });
  } catch (error) {
    console.error('[EDIT] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
