import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import Stripe from "stripe";
import { startTrackBuild } from "../../../../../lib/track-builder";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

// Create Supabase admin client
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

async function buildTrackConfig(metadata: Record<string, string | undefined>) {
  let trackConfig: any = {};
  let pendingTrackId: string | null = null;
  let configRetrieved = false;

  const pendingId = metadata.pending_track_id || metadata.track_id;
  if (pendingId) {
    try {
      const { data: pendingTrack, error } = await supabaseAdmin
        .from('pending_tracks')
        .select('track_config')
        .eq('id', pendingId)
        .single();

      if (!error && pendingTrack?.track_config) {
        trackConfig = pendingTrack.track_config;
        configRetrieved = true;
        pendingTrackId = pendingId;
      } else if (error) {
        console.error('[LOCAL-TRIGGER] Pending track lookup failed:', error);
      }
    } catch (error) {
      console.error('[LOCAL-TRIGGER] Error retrieving pending track:', error);
    }
  }

  if (!configRetrieved && metadata.track_config) {
    try {
      trackConfig = JSON.parse(metadata.track_config);
      configRetrieved = true;
    } catch (error) {
      console.error('[LOCAL-TRIGGER] Failed to parse track_config:', error);
    }
  }

  if (!configRetrieved && metadata.track_config_partial) {
    try {
      trackConfig = JSON.parse(metadata.track_config_partial);
      const chunksCount = parseInt(metadata.script_chunks_count || '0', 10);
      if (chunksCount > 0) {
        let fullScript = '';
        for (let i = 0; i < chunksCount; i++) {
          fullScript += metadata[`script_chunk_${i}`] || '';
        }
        trackConfig.script = fullScript;
      }
      configRetrieved = true;
    } catch (error) {
      console.error('[LOCAL-TRIGGER] Failed to parse track_config_partial:', error);
    }
  }

  if (!configRetrieved) {
    console.warn('[LOCAL-TRIGGER] No track config found in metadata');
  }

  return { trackConfig, pendingTrackId };
}

/**
 * POST /api/webhooks/stripe/local-trigger
 * Trigger track creation after successful checkout
 * This ensures immediate track creation on success page, with webhook as redundant backup
 * Idempotent: checks if purchase already exists before processing
 */
export async function POST(request: NextRequest) {

  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    console.log('[LOCAL-TRIGGER] Processing session:', sessionId);

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Only process if payment is complete
    if (session.payment_status !== 'paid') {
      console.log('[LOCAL-TRIGGER] Session not paid, skipping:', session.id);
      return NextResponse.json(
        { error: 'Session payment not completed' },
        { status: 400 }
      );
    }

    const metadata = session.metadata || {};
    const userId = metadata.user_id;
    const isFirstPurchase = metadata.is_first_purchase === 'true';

    if (!userId) {
      console.error('[LOCAL-TRIGGER] Missing user_id in session metadata');
      return NextResponse.json(
        { error: 'Missing user_id in session metadata' },
        { status: 400 }
      );
    }

    console.log('[LOCAL-TRIGGER] Processing purchase for user:', userId);

    // Save Stripe customer ID for fast checkout (Link / saved cards)
    const stripeCustomerId = typeof session.customer === 'string'
      ? session.customer
      : (session.customer as any)?.id;
    if (stripeCustomerId) {
      const { error: custError } = await supabaseAdmin
        .from('profiles')
        .update({
          stripe_customer_id: stripeCustomerId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .is('stripe_customer_id', null);

      if (!custError) {
        console.log('[LOCAL-TRIGGER] Saved Stripe customer ID:', stripeCustomerId);
      }
    }

    const { trackConfig, pendingTrackId } = await buildTrackConfig(metadata);

    // Create purchase record (idempotent with unique constraint on checkout_session_id)
    let purchase;
    try {
      const { data, error } = await supabaseAdmin
        .from('purchases')
        .insert({
          user_id: userId,
          checkout_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent as string,
          amount: session.amount_total || 0,
          currency: session.currency || 'usd',
          status: 'completed',
          metadata: {
            is_first_purchase: isFirstPurchase,
            pending_track_id: pendingTrackId
          },
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        // Check if it's a duplicate key error
        if (error.message?.includes('duplicate') || error.code === '23505') {
          console.log('[LOCAL-TRIGGER] Purchase already exists for session:', session.id);
          return NextResponse.json({
            success: true,
            message: 'Purchase already processed',
            duplicate: true
          });
        }
        throw error;
      }

      purchase = data;
      console.log('[LOCAL-TRIGGER] Created purchase:', purchase.id);

    } catch (error: any) {
      console.error('[LOCAL-TRIGGER] Failed to create purchase:', error);

      // If it's a unique constraint violation, the purchase was already processed
      if (error.code === '23505') {
        console.log('[LOCAL-TRIGGER] Purchase already processed for session:', session.id);
        return NextResponse.json({
          success: true,
          message: 'Purchase already processed',
          duplicate: true
        });
      }

      throw error;
    }

    // === TRACK EDIT FLOW ===
    if (metadata.type === 'track_edit') {
      const trackId = metadata.track_id;
      const editDataStr = metadata.edit_data;

      if (!trackId || !editDataStr) {
        console.error('[LOCAL-TRIGGER] Missing track_id or edit_data for track edit');
        return NextResponse.json({ success: false, error: 'Missing edit metadata' }, { status: 400 });
      }

      try {
        const editData = JSON.parse(editDataStr);

        const { data: track, error: trackError } = await supabaseAdmin
          .from('tracks')
          .select('*')
          .eq('id', trackId)
          .eq('user_id', userId)
          .single();

        if (trackError || !track) {
          console.error('[LOCAL-TRIGGER] Track not found for edit:', trackId);
          return NextResponse.json({ success: false, error: 'Track not found' }, { status: 404 });
        }

        const editCount = (track.edit_count || 0) + 1;
        const originalConfig = track.original_config || {
          voice_config: track.voice_config,
          music_config: track.music_config,
          frequency_config: track.frequency_config,
          output_config: track.output_config,
        };

        // Build updated configs
        const updatedFrequencyConfig = {
          solfeggio: editData.solfeggio?.enabled ? {
            enabled: true,
            frequency: editData.solfeggio.frequency || track.frequency_config?.solfeggio?.frequency || track.frequency_config?.solfeggio?.hz || 528,
            volume_db: editData.gains?.solfeggioDb ?? track.frequency_config?.solfeggio?.volume_db,
          } : null,
          binaural: editData.binaural?.enabled ? {
            enabled: true,
            band: editData.binaural.band || track.frequency_config?.binaural?.band || 'alpha',
            volume_db: editData.gains?.binauralDb ?? track.frequency_config?.binaural?.volume_db,
          } : null,
        };

        const updatedOutputConfig = {
          ...track.output_config,
          durationMin: editData.duration || track.output_config?.durationMin || 10,
          loop: editData.loop || track.output_config?.loop || { enabled: true, pause_seconds: 5 },
        };

        const updatedMusicConfig = track.music_config ? {
          ...track.music_config,
          volume_db: editData.gains?.musicDb ?? track.music_config.volume_db,
        } : null;

        const updatedVoiceConfig = editData.voiceSpeed != null && track.voice_config ? {
          ...track.voice_config,
          settings: { ...track.voice_config.settings, speed: editData.voiceSpeed },
        } : track.voice_config;

        // Update track — set status to 'draft' for re-render
        await supabaseAdmin.from('tracks').update({
          edit_count: editCount,
          original_config: originalConfig,
          voice_config: updatedVoiceConfig,
          frequency_config: updatedFrequencyConfig,
          output_config: updatedOutputConfig,
          music_config: updatedMusicConfig,
          status: 'draft',
          updated_at: new Date().toISOString(),
        }).eq('id', trackId);

        // Build worker payload
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
          backgroundMusic: updatedMusicConfig ? {
            id: updatedMusicConfig.id,
            name: updatedMusicConfig.name,
            url: updatedMusicConfig.url,
          } : null,
          solfeggio: updatedFrequencyConfig.solfeggio ? {
            enabled: true,
            hz: updatedFrequencyConfig.solfeggio.frequency,
            volume_db: editData.gains?.solfeggioDb,
          } : null,
          binaural: updatedFrequencyConfig.binaural ? {
            enabled: true,
            band: updatedFrequencyConfig.binaural.band,
            volume_db: editData.gains?.binauralDb,
          } : null,
          gains: editData.gains,
        };

        await supabaseAdmin.from('audio_job_queue').insert({
          track_id: trackId,
          user_id: userId,
          status: 'pending',
          payload: workerPayload,
          created_at: new Date().toISOString(),
        });

        console.log('[LOCAL-TRIGGER] Track edit processed and re-render queued:', trackId);

        return NextResponse.json({
          success: true,
          message: 'Track edit submitted',
          purchaseId: purchase.id,
          trackId,
          type: 'track_edit',
        });
      } catch (error) {
        console.error('[LOCAL-TRIGGER] Track edit processing error:', error);
        return NextResponse.json({ success: false, error: 'Failed to process track edit' }, { status: 500 });
      }
    }

    // === NEW TRACK FLOW ===

    // Mark first-track discount as used
    if (isFirstPurchase) {
      await supabaseAdmin
        .from('profiles')
        .update({
          first_track_discount_used: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      console.log('[LOCAL-TRIGGER] Marked first-track discount as used for user:', userId);
    }

    // Start track build if we have config
    if (purchase && trackConfig?.script && trackConfig?.voice) {
      try {
        const builtTrackId = await startTrackBuild({
          userId,
          purchaseId: purchase.id,
          trackConfig
        });

        console.log('[LOCAL-TRIGGER] Track build started:', builtTrackId);
      } catch (error) {
        console.error('[LOCAL-TRIGGER] Failed to start track build:', error);
      }
    }

    // Clean up pending track if it exists
    if (pendingTrackId) {
      await supabaseAdmin
        .from('pending_tracks')
        .delete()
        .eq('id', pendingTrackId);

      console.log('[LOCAL-TRIGGER] Cleaned up pending track:', pendingTrackId);
    }

    console.log('[LOCAL-TRIGGER] Successfully processed checkout:', {
      sessionId: session.id,
      userId,
      purchaseId: purchase.id,
      isFirstPurchase
    });

    return NextResponse.json({
      success: true,
      message: 'Track creation initiated',
      purchaseId: purchase.id
    });

  } catch (error) {
    console.error('[LOCAL-TRIGGER] Error processing request:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process track creation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
