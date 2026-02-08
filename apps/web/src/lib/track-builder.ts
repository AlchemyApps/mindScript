import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client for track building
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * Normalize track config to worker payload format
 * Ensures all builder variables are properly passed through
 */
function normalizeWorkerPayload(trackConfig: any): any {
  // Extract duration - builder may send as duration (minutes) or durationMin
  const durationMin = trackConfig.durationMin ?? trackConfig.duration ?? 5;

  // Extract pause between loops
  const pauseSec = trackConfig.pauseSec ?? trackConfig.loop?.pause_seconds ?? 5;

  // Extract loop mode
  const loopMode = trackConfig.loopMode ?? trackConfig.loop?.enabled ?? true;

  // Normalize voice config
  const voice = trackConfig.voice ? {
    provider: trackConfig.voice.provider || 'openai',
    id: trackConfig.voice.voice_id || trackConfig.voice.id || 'nova',
    model: trackConfig.voice.model || 'tts-1',
    speed: trackConfig.voice.speed || 1.0,
  } : null;

  // Normalize solfeggio config
  const solfeggio = trackConfig.solfeggio?.enabled ? {
    enabled: true,
    hz: trackConfig.solfeggio.hz || trackConfig.solfeggio.frequency,
    volume_db: trackConfig.solfeggio.volume_db ?? -18,
  } : null;

  // Normalize binaural config - keep band name for worker to convert
  const binaural = trackConfig.binaural?.enabled ? {
    enabled: true,
    band: trackConfig.binaural.band,
    // Also pass through explicit frequencies if provided
    carrierHz: trackConfig.binaural.carrierHz,
    beatHz: trackConfig.binaural.beatHz,
    volume_db: trackConfig.binaural.volume_db ?? -20,
  } : null;

  // Normalize gains - use builder values or defaults
  const gains = {
    voiceDb: trackConfig.gains?.voiceDb ?? -1,
    musicDb: trackConfig.gains?.musicDb ?? trackConfig.backgroundMusic?.volume_db ?? -10,
    solfeggioDb: trackConfig.gains?.solfeggioDb ?? solfeggio?.volume_db ?? -18,
    binauralDb: trackConfig.gains?.binauralDb ?? binaural?.volume_db ?? -20,
  };

  // Extract start delay
  const startDelaySec = trackConfig.startDelaySec ?? trackConfig.start_delay_seconds ?? 3;

  return {
    script: trackConfig.script || '',
    voice,
    durationMin,
    pauseSec,
    loopMode,
    startDelaySec,
    backgroundMusic: trackConfig.backgroundMusic ? {
      id: trackConfig.backgroundMusic.id,
      name: trackConfig.backgroundMusic.name,
      url: trackConfig.backgroundMusic.url,
    } : null,
    solfeggio,
    binaural,
    gains,
    // Preserve any additional config
    fade: trackConfig.fade,
    safety: trackConfig.safety,
    carrierType: trackConfig.carrierType,
    carrierGainDb: trackConfig.carrierGainDb,
  };
}

/**
 * Start track build process
 */
export async function startTrackBuild({
  userId,
  purchaseId,
  trackConfig
}: {
  userId: string;
  purchaseId: string;
  trackConfig: any;
}) {
  try {
    console.log('[BUILD] Starting track build for user:', userId);
    console.log('[BUILD] Raw trackConfig:', JSON.stringify(trackConfig, null, 2));

    // Normalize payload for worker
    const workerPayload = normalizeWorkerPayload(trackConfig);
    console.log('[BUILD] Normalized worker payload:', JSON.stringify(workerPayload, null, 2));

    // Create track record
    const { data: track, error: trackError } = await supabaseAdmin
      .from('tracks')
      .insert({
        user_id: userId,
        title: trackConfig.title || `Track - ${new Date().toLocaleDateString()}`,
        script: trackConfig.script || '',
        voice_config: {
          provider: workerPayload.voice?.provider || 'openai',
          voice_id: workerPayload.voice?.id || 'alloy',
          settings: trackConfig.voice?.settings || {}
        },
        music_config: workerPayload.backgroundMusic ? {
          id: workerPayload.backgroundMusic.id,
          name: workerPayload.backgroundMusic.name,
          url: workerPayload.backgroundMusic.url,
          volume_db: workerPayload.gains.musicDb
        } : null,
        frequency_config: (workerPayload.solfeggio || workerPayload.binaural) ? {
          solfeggio: workerPayload.solfeggio,
          binaural: workerPayload.binaural
        } : null,
        output_config: {
          format: 'mp3',
          quality: 'standard',
          is_public: false,
          durationMin: workerPayload.durationMin,
          loop: {
            enabled: workerPayload.loopMode,
            pause_seconds: workerPayload.pauseSec,
          },
        },
        start_delay_seconds: workerPayload.startDelaySec,
        status: 'draft', // Start as draft, will be updated when rendering completes
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (trackError || !track) {
      console.error('[BUILD] Failed to create track:', trackError);
      throw new Error('Failed to create track');
    }

    // Enqueue audio rendering job with normalized payload
    const { error: jobError } = await supabaseAdmin
      .from('audio_job_queue')
      .insert({
        track_id: track.id,
        user_id: userId,
        status: 'pending',
        payload: workerPayload,
        created_at: new Date().toISOString()
      });

    if (jobError) {
      console.error('[BUILD] Failed to enqueue job:', jobError);
      throw new Error(`Failed to enqueue audio job: ${jobError.message}`);
    }

    // Grant track access
    await supabaseAdmin
      .from('track_access')
      .insert({
        user_id: userId,
        track_id: track.id,
        access_type: 'owned',
        granted_at: new Date().toISOString()
      });

    // Update purchase with track ID
    await supabaseAdmin
      .from('purchases')
      .update({ track_id: track.id })
      .eq('id', purchaseId);

    console.log('[BUILD] Track build started:', {
      userId,
      trackId: track.id,
      purchaseId
    });

    return track.id;

  } catch (error) {
    console.error('[BUILD] Error starting track build:', error);
    throw error;
  }
}
