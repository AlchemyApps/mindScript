import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceRoleClient } from "@mindscript/auth/server";
import { startTrackBuild } from "../../../../lib/track-builder";

// Set runtime to Node.js for raw body access
export const runtime = 'nodejs';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

const supabaseAdmin = createServiceRoleClient();

type StripeMetadata = Record<string, string | undefined>;

const VOICE_PREVIEW_TEXT =
  "Welcome to your personalized audio experience. Every word you hear is spoken in your own voice, crafted just for you.";

async function generateVoicePreview(
  elevenLabsVoiceId: string,
  userId: string,
): Promise<string | null> {
  try {
    // 1. Generate TTS via ElevenLabs
    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY || '',
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: VOICE_PREVIEW_TEXT,
          model_id: 'eleven_monolingual_v1',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      },
    );

    if (!ttsRes.ok) {
      console.warn('[WEBHOOK] TTS preview generation failed:', ttsRes.status, await ttsRes.text());
      return null;
    }

    const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());

    // 2. Upload to track-previews bucket
    const previewPath = `voice-previews/${userId}/${elevenLabsVoiceId}.mp3`;
    const uploadRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/previews/${previewPath}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'audio/mpeg',
          'x-upsert': 'true',
        },
        body: audioBuffer,
      },
    );

    if (!uploadRes.ok) {
      console.warn('[WEBHOOK] Preview upload failed:', uploadRes.status, await uploadRes.text());
      return null;
    }

    // 3. Return public URL
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/previews/${previewPath}`;
  } catch (error) {
    console.warn('[WEBHOOK] Voice preview generation error:', error);
    return null;
  }
}

async function resolveUserIdentity(
  rawUserId: string | undefined,
  fallbackEmail?: string | null
): Promise<{ userId: string | null; email: string | null }> {
  if (!rawUserId) {
    return { userId: null, email: fallbackEmail || null };
  }

  if (!rawUserId.includes('@')) {
    return { userId: rawUserId, email: fallbackEmail || null };
  }

  const normalizedEmail = rawUserId.toLowerCase();

  // Look up profile first (fast path)
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .single();

    if (profile?.id) {
      return { userId: profile.id, email: normalizedEmail };
    }
  } catch (error) {
    console.error('[WEBHOOK] Profile lookup failed for email', normalizedEmail, error);
  }

  // Fall back to auth admin lookup
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
      console.error('[WEBHOOK] Supabase admin user lookup failed:', error);
    }

    const user = (data?.users as any[])?.find((u: any) => u.email === normalizedEmail);
    if (user?.id) {
      return { userId: user.id, email: normalizedEmail };
    }
  } catch (error) {
    console.error('[WEBHOOK] Failed to resolve user via admin API:', error);
  }

  return { userId: null, email: normalizedEmail };
}

async function loadTrackConfigFromMetadata(metadata: StripeMetadata) {
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
        console.log('[WEBHOOK] Retrieved track config from pending_tracks:', pendingId);
      } else if (error) {
        console.error('[WEBHOOK] Pending track lookup failed:', error);
      }
    } catch (error) {
      console.error('[WEBHOOK] Error retrieving pending track:', error);
    }
  }

  if (!configRetrieved) {
    if (metadata.track_config) {
      try {
        trackConfig = JSON.parse(metadata.track_config);
        configRetrieved = true;
        console.log('[WEBHOOK] Parsed full track config from metadata');
      } catch (error) {
        console.error('[WEBHOOK] Failed to parse track_config:', error);
      }
    } else if (metadata.track_config_partial) {
      try {
        trackConfig = JSON.parse(metadata.track_config_partial);
        const chunksCount = parseInt(metadata.script_chunks_count || '0', 10);
        if (chunksCount > 0) {
          let fullScript = '';
          for (let i = 0; i < chunksCount; i++) {
            fullScript += metadata[`script_chunk_${i}`] || '';
          }
          trackConfig.script = fullScript;
          console.log(`[WEBHOOK] Reconstructed script from ${chunksCount} chunks`);
        }
        configRetrieved = true;
      } catch (error) {
        console.error('[WEBHOOK] Failed to parse track_config_partial:', error);
      }
    } else {
      // FALLBACK PATH: Building config from individual metadata fields
      // This means pending_tracks lookup failed AND no track_config in metadata
      // Volume settings will use defaults - user's custom volumes may be lost
      console.warn('[WEBHOOK] ⚠️ Using metadata fallback path - custom volume settings will use defaults!', {
        pending_track_id: metadata.pending_track_id || metadata.track_id,
        has_track_config: !!metadata.track_config,
        has_track_config_partial: !!metadata.track_config_partial,
      });

      const chunksCount = parseInt(metadata.script_chunks_count || '0', 10);
      let script = '';
      if (chunksCount > 0) {
        for (let i = 0; i < chunksCount; i++) {
          script += metadata[`script_chunk_${i}`] || '';
        }
      }

      trackConfig = {
        title: `Track - ${new Date().toLocaleDateString()}`,
        script,
        voice: metadata.voice_provider && metadata.voice_id ? {
          provider: metadata.voice_provider,
          voice_id: metadata.voice_id,
          name: metadata.voice_name || metadata.voice_id,
          settings: {}
        } : undefined,
        duration: metadata.duration ? parseInt(metadata.duration, 10) : 10,
        backgroundMusic: metadata.background_music_id && metadata.background_music_id !== 'none'
          ? {
              id: metadata.background_music_id,
              name: metadata.background_music_name || 'Background Music',
              volume_db: -20
            }
          : null,
        solfeggio: metadata.solfeggio_frequency ? {
          enabled: true,
          frequency: parseInt(metadata.solfeggio_frequency, 10),
          volume_db: -20
        } : null,
        binaural: metadata.binaural_band ? {
          enabled: true,
          band: metadata.binaural_band,
          volume_db: -20
        } : null,
      };
    }
  }

  return { trackConfig, pendingTrackId };
}

async function markDiscountUsed(userId: string) {
  try {
    await supabaseAdmin
      .from('profiles')
      .update({
        first_track_discount_used: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
  } catch (error) {
    console.error('[WEBHOOK] Failed to mark discount as used:', error);
  }
}

async function enqueuePurchaseNotification(userId: string, purchaseId: string, trackTitle?: string) {
  try {
    await supabaseAdmin
      .from('notifications_queue')
      .insert({
        user_id: userId,
        type: 'purchase_confirmation',
        data: {
          purchase_id: purchaseId,
          track_title: trackTitle || 'Your new track',
        },
        created_at: new Date().toISOString(),
      });
  } catch (error) {
    console.error('[WEBHOOK] Failed to enqueue purchase notification:', error);
  }
}

async function recordPurchase({
  userId,
  sessionId,
  paymentIntentId,
  amount,
  currency,
  metadata,
}: {
  userId: string;
  sessionId: string;
  paymentIntentId?: string | null;
  amount: number;
  currency?: string | null;
  metadata: StripeMetadata;
}) {
  const cogsCents = parseInt(metadata.cogs_cents || '0', 10) || 0;

  const record = {
    user_id: userId,
    checkout_session_id: sessionId,
    stripe_payment_intent_id: paymentIntentId || null,
    amount,
    cogs_cents: cogsCents,
    currency: currency || 'usd',
    status: 'completed',
    metadata: {
      type: metadata.type || null,
      is_first_purchase: metadata.is_first_purchase,
      pending_track_id: metadata.pending_track_id || metadata.track_id || null,
      ff_tier: metadata.ff_tier || null,
    },
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabaseAdmin
    .from('purchases')
    .insert(record)
    .select()
    .single();

  if (error) {
    if (error.message?.includes('duplicate') || error.code === '23505') {
      console.log('[WEBHOOK] Purchase already exists for session:', sessionId);
      const { data: existing } = await supabaseAdmin
        .from('purchases')
        .select('*')
        .eq('checkout_session_id', sessionId)
        .single();
      return existing;
    }
    throw error;
  }

  return data;
}

async function processCompletedPurchase({
  metadata,
  amountTotal,
  currency,
  paymentIntentId,
  sessionId,
  customerEmail,
}: {
  metadata: StripeMetadata;
  amountTotal: number;
  currency?: string | null;
  paymentIntentId?: string | null;
  sessionId: string;
  customerEmail?: string | null;
}) {
  const rawUserId = metadata.user_id || metadata.userId;
  const fallbackEmail = metadata.user_email || metadata.userEmail || customerEmail || null;

  const { userId, email } = await resolveUserIdentity(rawUserId, fallbackEmail);

  if (!userId) {
    throw new Error('Unable to resolve user ID from metadata');
  }

  const { trackConfig, pendingTrackId } = await loadTrackConfigFromMetadata(metadata);

  const purchase = await recordPurchase({
    userId,
    sessionId,
    paymentIntentId,
    amount: amountTotal || 0,
    currency,
    metadata,
  });

  const isFirstPurchase = metadata.is_first_purchase === 'true';
  if (isFirstPurchase) {
    await markDiscountUsed(userId);
  }

  // Save Stripe customer ID for fast checkout (Stripe Link)
  if (metadata.stripe_customer_id) {
    try {
      await supabaseAdmin
        .from('profiles')
        .update({
          stripe_customer_id: metadata.stripe_customer_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .is('stripe_customer_id', null); // Only set if not already saved
      console.log('[WEBHOOK] Saved Stripe customer ID for user:', userId);
    } catch (error) {
      console.error('[WEBHOOK] Failed to save Stripe customer ID:', error);
    }
  }

  if (trackConfig.script && trackConfig.voice) {
    try {
      await startTrackBuild({
        userId,
        purchaseId: purchase.id,
        trackConfig,
      });
    } catch (error) {
      console.error('[WEBHOOK] Failed to start track build:', error);
    }
  } else {
    console.warn('[WEBHOOK] Skipping track build due to missing script or voice');
  }

  if (pendingTrackId) {
    try {
      await supabaseAdmin
        .from('pending_tracks')
        .delete()
        .eq('id', pendingTrackId);
      console.log('[WEBHOOK] Cleaned up pending track:', pendingTrackId);
    } catch (error) {
      console.error('[WEBHOOK] Failed to clean up pending track:', error);
    }
  }

  await enqueuePurchaseNotification(userId, purchase.id, trackConfig.title);

  return { userId, email, purchaseId: purchase.id };
}

async function processVoiceClonePurchase({
  metadata,
  sessionId,
  amountTotal,
  paymentIntentId,
}: {
  metadata: StripeMetadata;
  sessionId: string;
  amountTotal: number;
  paymentIntentId?: string | null;
}) {
  const userId = metadata.user_id;
  if (!userId) throw new Error('Missing user_id in voice clone metadata');

  // Record purchase
  await recordPurchase({
    userId,
    sessionId,
    paymentIntentId,
    amount: amountTotal,
    currency: 'usd',
    metadata: { ...metadata, type: 'voice_clone' },
  });

  // Save Stripe customer ID
  if (metadata.stripe_customer_id) {
    await supabaseAdmin
      .from('profiles')
      .update({ stripe_customer_id: metadata.stripe_customer_id, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .is('stripe_customer_id', null);
  }

  const voiceName = metadata.voice_name || 'My Voice';
  const sampleFilePath = metadata.sample_file_path;
  const sampleUrl = metadata.sample_url;
  const consentData = metadata.consent_data;

  if (!sampleFilePath || !sampleUrl) {
    console.error('[WEBHOOK] Missing voice sample data in metadata');
    return;
  }

  try {
    // Download audio from Supabase storage
    const { data: audioData, error: downloadError } = await supabaseAdmin.storage
      .from('voice-samples')
      .download(sampleFilePath);

    if (downloadError || !audioData) {
      console.error('[WEBHOOK] Failed to download voice sample:', downloadError);
      // Still create the record so user sees "processing" state
      await supabaseAdmin.from('cloned_voices').insert({
        user_id: userId,
        voice_id: 'pending',
        voice_name: voiceName,
        status: 'failed',
        error_message: 'Failed to download audio sample',
      });
      return;
    }

    const audioBuffer = Buffer.from(await audioData.arrayBuffer());

    // Create cloned_voices record with processing status
    const { data: voiceRecord, error: dbError } = await supabaseAdmin
      .from('cloned_voices')
      .insert({
        user_id: userId,
        voice_id: 'pending',
        voice_name: voiceName,
        sample_file_url: sampleUrl,
        sample_file_size: audioBuffer.length,
        status: 'processing',
      })
      .select()
      .single();

    if (dbError || !voiceRecord) {
      console.error('[WEBHOOK] Failed to create voice record:', dbError);
      return;
    }

    // Store consent
    if (consentData) {
      try {
        const consent = JSON.parse(consentData);
        await supabaseAdmin.from('voice_consent_records').insert({
          voice_id: voiceRecord.id,
          user_id: userId,
          has_consent: consent.hasConsent ?? true,
          is_over_18: consent.isOver18 ?? true,
          accepts_terms: consent.acceptsTerms ?? true,
          owns_voice: consent.ownsVoice ?? true,
          understands_usage: consent.understandsUsage ?? true,
          no_impersonation: consent.noImpersonation ?? true,
          consent_text: 'User consented to voice cloning terms and conditions v1.0',
          consent_version: '1.0',
        });
      } catch (e) {
        console.error('[WEBHOOK] Failed to store consent:', e);
      }
    }

    // Call ElevenLabs directly (bypass SDK to avoid undici fetch issues)
    const ext = sampleFilePath.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = { webm: 'audio/webm', mp3: 'audio/mpeg', wav: 'audio/wav', mp4: 'audio/mp4', ogg: 'audio/ogg' };
    const derivedMimeType = (ext && mimeMap[ext]) || 'audio/webm';

    const form = new FormData();
    form.append('name', voiceName);
    form.append('files', new Blob([audioBuffer], { type: derivedMimeType }), sampleFilePath.split('/').pop() || 'voice-sample.webm');

    let elevenLabsVoiceId: string | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch('https://api.elevenlabs.io/v1/voices/add', {
          method: 'POST',
          headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY || '' },
          body: form,
        });

        if (res.ok) {
          const body = await res.json();
          elevenLabsVoiceId = body.voice_id;
          console.log(`[WEBHOOK] ElevenLabs clone succeeded on attempt ${attempt}:`, elevenLabsVoiceId);
          break;
        }

        const errText = await res.text();
        console.error(`[WEBHOOK] ElevenLabs attempt ${attempt} failed: HTTP ${res.status}`, errText);
      } catch (fetchErr) {
        console.error(`[WEBHOOK] ElevenLabs attempt ${attempt} error:`, (fetchErr as Error).message);
      }

      if (attempt < 3) {
        await new Promise(r => setTimeout(r, attempt * 2000));
      }
    }

    if (!elevenLabsVoiceId) {
      console.error('[WEBHOOK] Voice cloning failed after 3 attempts');
      await supabaseAdmin.from('cloned_voices').update({
        status: 'failed',
        error_message: 'Voice cloning failed after 3 attempts',
      }).eq('id', voiceRecord.id);
      return;
    }

    // Update voice record with ElevenLabs voice ID
    await supabaseAdmin.from('cloned_voices').update({
      voice_id: elevenLabsVoiceId,
      status: 'active',
    }).eq('id', voiceRecord.id);

    // Generate TTS preview (non-blocking — voice still works if this fails)
    const previewUrl = await generateVoicePreview(elevenLabsVoiceId, userId);
    if (previewUrl) {
      console.log('[WEBHOOK] Voice preview generated:', previewUrl);
    } else {
      console.warn('[WEBHOOK] Voice preview generation failed, continuing without preview');
    }

    // Also add to voice_catalog for VoicePicker integration
    await supabaseAdmin.from('voice_catalog').insert({
      internal_code: `elevenlabs:${elevenLabsVoiceId}`,
      display_name: voiceName,
      description: 'Custom cloned voice',
      gender: null,
      tier: 'custom',
      provider: 'elevenlabs',
      provider_voice_id: elevenLabsVoiceId,
      preview_url: previewUrl,
      is_enabled: true,
      sort_order: 0,
      owner_user_id: userId,
    });

    console.log('[WEBHOOK] Voice cloned successfully:', elevenLabsVoiceId);
  } catch (error) {
    console.error('[WEBHOOK] Voice clone processing error:', error);
  }
}

async function processTrackEditPurchase({
  metadata,
  sessionId,
  amountTotal,
  paymentIntentId,
}: {
  metadata: StripeMetadata;
  sessionId: string;
  amountTotal: number;
  paymentIntentId?: string | null;
}) {
  const userId = metadata.user_id;
  const trackId = metadata.track_id;
  const editDataStr = metadata.edit_data;

  if (!userId || !trackId) {
    throw new Error('Missing user_id or track_id in track edit metadata');
  }

  // Record purchase
  await recordPurchase({
    userId,
    sessionId,
    paymentIntentId,
    amount: amountTotal,
    currency: 'usd',
    metadata: { ...metadata, type: 'track_edit' },
  });

  // Save Stripe customer ID
  if (metadata.stripe_customer_id) {
    await supabaseAdmin
      .from('profiles')
      .update({ stripe_customer_id: metadata.stripe_customer_id, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .is('stripe_customer_id', null);
  }

  if (!editDataStr) {
    console.error('[WEBHOOK] Missing edit_data in track edit metadata');
    return;
  }

  try {
    const editData = JSON.parse(editDataStr);

    // Fetch current track
    const { data: track, error: trackError } = await supabaseAdmin
      .from('tracks')
      .select('*')
      .eq('id', trackId)
      .eq('user_id', userId)
      .single();

    if (trackError || !track) {
      console.error('[WEBHOOK] Track not found for edit:', trackId);
      return;
    }

    // Save original config on first edit
    const editCount = (track.edit_count || 0) + 1;
    const originalConfig = track.original_config || {
      voice_config: track.voice_config,
      music_config: track.music_config,
      frequency_config: track.frequency_config,
      output_config: track.output_config,
    };

    // Build updated configs (mirrors logic from /api/tracks/[id]/edit)
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

    // Update track record — set status to 'draft' for re-render
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

    // Build full worker payload (same structure as free edit route)
    const workerPayload = {
      script: track.script || '',
      voice: track.voice_config ? {
        provider: track.voice_config.provider || 'openai',
        id: track.voice_config.voice_id || 'nova',
        model: track.voice_config.model || 'tts-1',
        speed: editData.voiceSpeed ?? track.voice_config.settings?.speed ?? 0.9,
      } : null,
      durationMin: updatedOutputConfig.durationMin,
      pauseSec: updatedOutputConfig.loop?.pause_seconds ?? 5,
      loopMode: updatedOutputConfig.loop?.enabled ?? true,
      startDelaySec: editData.startDelaySec ?? track.start_delay_seconds ?? 3,
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

    // Enqueue re-render job with full worker payload
    await supabaseAdmin.from('audio_job_queue').insert({
      track_id: trackId,
      user_id: userId,
      status: 'pending',
      payload: workerPayload,
      created_at: new Date().toISOString(),
    });

    console.log('[WEBHOOK] Track edit processed and re-render queued:', trackId);
  } catch (error) {
    console.error('[WEBHOOK] Track edit processing error:', error);
  }
}

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events with idempotency
 */
export async function POST(request: NextRequest) {
  // Get raw body as ArrayBuffer first, then convert to string
  // This ensures we get the exact body that Stripe sent
  const rawBody = await request.arrayBuffer();
  const body = Buffer.from(rawBody).toString('utf8');

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('[WEBHOOK] STRIPE_WEBHOOK_SECRET is not configured');
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 }
    );
  }

  console.log('[WEBHOOK] Received event:', event.type, event.id);

  // Check for duplicate event (idempotency)
  const { data: existingEvent } = await supabaseAdmin
    .from("webhook_events")
    .select("id")
    .eq("event_id", event.id)
    .single();

  if (existingEvent) {
    console.log(`[WEBHOOK] Duplicate event ${event.id}, skipping`);
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Record the webhook event
  await supabaseAdmin.from("webhook_events").insert({
    event_id: event.id,
    event_type: event.type,
    provider: "stripe",
    payload: event,
    signature: signature || '',
    created_at: new Date().toISOString()
  });

  try {
    switch (event.type as string) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.payment_status !== 'paid') {
          console.log('[WEBHOOK] Session not paid, skipping:', session.id);
          break;
        }

        const metadata = session.metadata || {};

        // Capture Stripe customer ID from the session for fast checkout
        const stripeCustomerId = typeof session.customer === 'string'
          ? session.customer
          : session.customer?.id;
        if (stripeCustomerId) {
          metadata.stripe_customer_id = stripeCustomerId;
        }

        // Handle voice clone checkout
        if (metadata.type === 'voice_clone') {
          await processVoiceClonePurchase({
            metadata,
            sessionId: session.id,
            amountTotal: session.amount_total || 0,
            paymentIntentId: session.payment_intent as string | null,
          });
          console.log('[WEBHOOK] Processed voice clone purchase:', session.id);
          break;
        }

        // Handle track edit checkout
        if (metadata.type === 'track_edit') {
          await processTrackEditPurchase({
            metadata,
            sessionId: session.id,
            amountTotal: session.amount_total || 0,
            paymentIntentId: session.payment_intent as string | null,
          });
          console.log('[WEBHOOK] Processed track edit purchase:', session.id);
          break;
        }

        await processCompletedPurchase({
          metadata,
          amountTotal: session.amount_total || 0,
          currency: session.currency || 'usd',
          paymentIntentId: session.payment_intent as string | null,
          sessionId: session.id,
          customerEmail: session.customer_details?.email || session.customer_email || null,
        });

        console.log('[WEBHOOK] Successfully processed checkout.session.completed:', session.id);
        break;
      }

      case "invoice.payment.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('[WEBHOOK] Invoice payment paid:', invoice.id);
        const metadata: StripeMetadata = {
          ...(invoice.metadata || {}),
        };
        if (invoice.lines?.data) {
          for (const line of invoice.lines.data) {
            Object.assign(metadata, line.metadata);
          }
        }

        await processCompletedPurchase({
          metadata,
          amountTotal: invoice.amount_paid || 0,
          currency: invoice.currency || 'usd',
          paymentIntentId: invoice.payment_intent as string | null,
          sessionId: invoice.id,
          customerEmail: invoice.customer_email || null,
        });

        break;
      }

      case "payment_intent.succeeded": {
        // Handle successful payment intent if needed
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('[WEBHOOK] Payment intent succeeded:', paymentIntent.id);
        break;
      }

      case "payment_intent.payment_failed": {
        // Handle failed payment
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.error('[WEBHOOK] Payment failed:', paymentIntent.id);

        // Update purchase status if it exists
        await supabaseAdmin
          .from('purchases')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('stripe_payment_intent_id', paymentIntent.id);

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        // Handle subscription events if needed
        const subscription = event.data.object as Stripe.Subscription;
        console.log('[WEBHOOK] Subscription event:', event.type, subscription.id);
        break;
      }

      default: {
        console.log(`[WEBHOOK] Unhandled event type: ${event.type}`);
      }
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('[WEBHOOK] Error processing webhook:', error);

    // Return success to avoid Stripe retries for non-recoverable errors
    // Log the error for manual investigation
    return NextResponse.json({
      received: true,
      error: 'Internal processing error logged'
    });
  }
}
