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

    // Create track record
    const { data: track, error: trackError } = await supabaseAdmin
      .from('tracks')
      .insert({
        user_id: userId,
        title: trackConfig.title || `Track - ${new Date().toLocaleDateString()}`,
        script: trackConfig.script || '',
        voice_config: {
          provider: trackConfig.voice?.provider || 'openai',
          voice_id: trackConfig.voice?.voice_id || 'alloy',
          settings: trackConfig.voice?.settings || {}
        },
        music_config: trackConfig.backgroundMusic ? {
          id: trackConfig.backgroundMusic.id,
          name: trackConfig.backgroundMusic.name,
          url: trackConfig.backgroundMusic.url,
          volume_db: trackConfig.backgroundMusic.volume_db || -20
        } : null,
        frequency_config: (trackConfig.solfeggio || trackConfig.binaural) ? {
          solfeggio: trackConfig.solfeggio,
          binaural: trackConfig.binaural
        } : null,
        output_config: {
          format: 'mp3',
          quality: 'standard',
          is_public: false,
          loop: trackConfig.loop || {
            enabled: true,
            pause_seconds: 5,
          },
        },
        status: 'draft', // Start as draft, will be updated when rendering completes
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (trackError || !track) {
      console.error('[BUILD] Failed to create track:', trackError);
      throw new Error('Failed to create track');
    }

    // Enqueue audio rendering job
    const { error: jobError } = await supabaseAdmin
      .from('audio_job_queue')
      .insert({
        track_id: track.id,
        user_id: userId,
        status: 'pending',
        payload: trackConfig,
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
