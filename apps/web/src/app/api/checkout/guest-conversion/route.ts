import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';
import { calculateVoiceFee, type VoiceTier } from '@mindscript/schemas';
import { calculateAICost } from '../../../../lib/pricing/cost-calculator';
import { getUserFFTier } from '../../../../lib/pricing/ff-tier';
import { createFreeTrack } from '../../../../lib/track-builder';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

// Initialize Supabase Admin Client
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

// Request validation schema - matches what BuilderForm actually sends
const GuestCheckoutRequestSchema = z.object({
  userId: z.string(), // User ID or email from authenticated session
  builderState: z.object({
    title: z.string().min(3).max(80),
    script: z.string(),
    voice: z.object({
      provider: z.enum(['openai', 'elevenlabs', 'uploaded']),
      voice_id: z.string(),
      name: z.string().optional(),
      tier: z.enum(['included', 'premium', 'custom']).optional(),
      internalCode: z.string().optional(),
      settings: z.object({
        speed: z.number().optional(),
        pitch: z.number().optional(),
      }).optional(),
    }),
    music: z.object({
      id: z.string().optional(),
      volume_db: z.number(),
    }).optional(),
    solfeggio: z.object({
      enabled: z.boolean(),
      frequency: z.number().optional(),
      volume_db: z.number(),
    }).optional(),
    binaural: z.object({
      enabled: z.boolean(),
      band: z.enum(['delta', 'theta', 'alpha', 'beta', 'gamma']).optional(),
      volume_db: z.number(),
    }).optional(),
    duration: z.number().optional(), // Frontend might not always send this
    loop: z.object({
      enabled: z.boolean(),
      pause_seconds: z.number().min(1).max(30),
    }),
  }),
  successUrl: z.string(),
  cancelUrl: z.string(),
  priceAmount: z.number(), // in cents
  firstTrackDiscount: z.boolean(), // Track if discount was used
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    console.log('Received checkout request:', { userId: body.userId, priceAmount: body.priceAmount, firstTrackDiscount: body.firstTrackDiscount });

    const validationResult = GuestCheckoutRequestSchema.safeParse(body);

    if (!validationResult.success) {
      console.error('Validation failed:', validationResult.error.flatten());
      return NextResponse.json(
        { error: "Invalid request data", details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    let { userId, builderState, successUrl, cancelUrl, priceAmount, firstTrackDiscount } = validationResult.data;

    // If userId looks like an email, try to find the actual user ID
    if (userId.includes('@')) {
      console.log('UserId is an email, looking up actual user ID...');
      console.log('Using email as identifier:', userId);
    }

    // Look up existing Stripe customer ID for fast checkout (Stripe Link)
    let stripeCustomerId: string | undefined;
    if (!userId.includes('@')) {
      try {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('stripe_customer_id')
          .eq('id', userId)
          .single();

        if (profile?.stripe_customer_id) {
          stripeCustomerId = profile.stripe_customer_id;
          console.log('Found existing Stripe customer:', stripeCustomerId);
        }
      } catch (error) {
        console.error('Failed to look up Stripe customer ID:', error);
      }
    }

    // Build description with selected features
    const features: string[] = [];
    if (builderState.music?.id && builderState.music.id !== 'none') {
      features.push(`Background Music`);
    }
    if (builderState.solfeggio?.enabled) {
      features.push(`Solfeggio: ${builderState.solfeggio.frequency || 528} Hz`);
    }
    if (builderState.binaural?.enabled) {
      features.push(`Binaural: ${builderState.binaural.band || 'theta'}`);
    }

    // Get voice name - use provided name or fallback to voice_id
    const voiceName = builderState.voice.name ||
      (builderState.voice.voice_id.charAt(0).toUpperCase() + builderState.voice.voice_id.slice(1));
    const voiceTier = (builderState.voice.tier || 'included') as VoiceTier;
    const duration = builderState.duration || 10; // Default to 10 minutes if not specified

    // Calculate voice fee for premium/custom voices based on script length
    const scriptLength = builderState.script.length;
    const voiceFeeCents = calculateVoiceFee(scriptLength, voiceTier);

    // Add voice tier to features if premium/custom
    if (voiceTier === 'premium') {
      features.push(`Premium Voice: ${voiceName}`);
    } else if (voiceTier === 'custom') {
      features.push(`Custom Voice: ${voiceName}`);
    }

    const description = `${duration} min track with ${voiceName}${features.length > 0 ? ` • ${features.join(' • ')}` : ''}`;

    // Create line items - base track plus voice fee if applicable
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: 'usd',
          unit_amount: priceAmount, // Base price from frontend (includes add-ons but not voice fee)
          product_data: {
            name: firstTrackDiscount ? 'MindScript First Track (Special Pricing)' : 'MindScript Track',
            description,
            metadata: {
              type: 'complete_track',
              has_background_music: (!!builderState.music?.id && builderState.music.id !== 'none').toString(),
              has_solfeggio: (!!builderState.solfeggio?.enabled).toString(),
              has_binaural: (!!builderState.binaural?.enabled).toString(),
              voice_tier: voiceTier,
            },
          },
        },
        quantity: 1,
      },
    ];

    // Add voice fee as separate line item for premium/custom voices
    if (voiceFeeCents > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          unit_amount: voiceFeeCents,
          product_data: {
            name: voiceTier === 'premium' ? 'Premium Voice' : 'Custom Voice',
            description: `${voiceName} - ${scriptLength} characters`,
            metadata: {
              type: 'voice_fee',
              voice_tier: voiceTier,
              voice_name: voiceName,
              voice_id: builderState.voice.voice_id,
              script_length: scriptLength.toString(),
            },
          },
        },
        quantity: 1,
      });
    }

    // Look up background music details if selected
    let backgroundMusicData: { id: string; name: string; url: string; volume_db: number } | null = null;
    if (builderState.music?.id && builderState.music.id !== 'none') {
      try {
        const { data: musicTrack, error: musicError } = await supabaseAdmin
          .from('background_tracks')
          .select('id, title, url')
          .eq('slug', builderState.music.id)
          .eq('is_active', true)
          .single();

        if (musicError) {
          console.error('Failed to look up background music:', musicError);
        } else if (musicTrack) {
          // Get public URL for the music file from storage
          const { data: urlData } = supabaseAdmin.storage
            .from('background-music')
            .getPublicUrl(musicTrack.url);

          backgroundMusicData = {
            id: musicTrack.id,
            name: musicTrack.title || 'Background Music',
            url: urlData?.publicUrl || '',
            volume_db: builderState.music.volume_db ?? -10,
          };
          console.log('Resolved background music URL:', backgroundMusicData.url);
        }
      } catch (error) {
        console.error('Error looking up background music:', error);
      }
    }

    // Create full track config for webhook processing
    const trackConfig = {
      title: builderState.title || `Track - ${new Date().toLocaleDateString()}`,
      script: builderState.script,
      voice: {
        provider: builderState.voice.provider,
        voice_id: builderState.voice.voice_id,
        name: voiceName, // Use the derived voice name
        tier: voiceTier,
        internalCode: builderState.voice.internalCode,
        settings: builderState.voice.settings || {}
      },
      duration: duration,
      loop: builderState.loop || {
        enabled: true,
        pause_seconds: 5,
      },
      backgroundMusic: backgroundMusicData,
      solfeggio: builderState.solfeggio?.enabled ? {
        enabled: true,
        frequency: builderState.solfeggio.frequency || 528,
        volume_db: builderState.solfeggio.volume_db ?? -18,
      } : null,
      binaural: builderState.binaural?.enabled ? {
        enabled: true,
        band: builderState.binaural.band || 'theta',
        volume_db: builderState.binaural.volume_db ?? -20,
      } : null,
      // Include gains object for explicit volume control
      gains: {
        voiceDb: -1,
        musicDb: builderState.music?.volume_db ?? -10,
        solfeggioDb: builderState.solfeggio?.volume_db ?? -18,
        binauralDb: builderState.binaural?.volume_db ?? -20,
      },
    };

    // Store track config in pending_tracks table for persistence
    // This ensures the config survives even if webhooks fail
    let pendingTrackId: string | null = null;
    try {
      // Get user email if we have a user ID
      let userEmail = userId.includes('@') ? userId : '';
      if (!userEmail && !userId.includes('@')) {
        // Try to get email from Supabase auth
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId);
        userEmail = user?.email || '';
      }

      const { data: pendingTrack, error: pendingError } = await supabaseAdmin
        .from('pending_tracks')
        .insert({
          user_email: userEmail || userId, // Fallback to userId if no email
          track_config: trackConfig
        })
        .select()
        .single();

      if (pendingError) {
        console.error('Failed to store pending track:', pendingError);
        // Don't fail checkout, just log the error
      } else {
        pendingTrackId = pendingTrack.id;
        console.log('Stored pending track:', pendingTrackId);
      }
    } catch (error) {
      console.error('Error storing pending track:', error);
      // Continue without pending track ID
    }

    // Store builder state in metadata (Stripe has a 500 character limit per value)
    // Try to fit the full config first, fall back to chunking if too large
    const trackConfigStr = JSON.stringify(trackConfig);
    const scriptChunks = builderState.script.match(/.{1,400}/g) || [];

    const metadata: Record<string, string> = {
      user_id: userId, // Critical for webhook - can be UUID or email
      user_email: userId.includes('@') ? userId : '', // Store email separately if that's what we have
      conversion_type: 'guest_to_user',
      is_first_purchase: firstTrackDiscount.toString(), // Aligned with webhook expectations
      first_track: 'true',
      total_amount: (priceAmount + voiceFeeCents).toString(),
      voice_tier: voiceTier,
      voice_fee_cents: voiceFeeCents.toString(),
      cogs_cents: calculateAICost({ scriptLength, voiceProvider: builderState.voice.provider }).totalCents.toString(),
    };

    // Add pending track ID if we have one
    if (pendingTrackId) {
      metadata.pending_track_id = pendingTrackId;
    }

    // Only embed track config in metadata if we DON'T have a pending_track_id
    // (the webhook will fetch from pending_tracks table instead)
    if (!pendingTrackId) {
      if (trackConfigStr.length <= 500) {
        metadata.track_config = trackConfigStr;
      } else {
        // Store minimal config without script and without long URLs
        const minimalConfig = {
          ...trackConfig,
          script: '',
          backgroundMusic: trackConfig.backgroundMusic ? {
            id: trackConfig.backgroundMusic.id,
            name: trackConfig.backgroundMusic.name,
            volume_db: trackConfig.backgroundMusic.volume_db,
          } : null,
        };
        const minimalStr = JSON.stringify(minimalConfig);
        if (minimalStr.length <= 500) {
          metadata.track_config_partial = minimalStr;
        }

        // Add script chunks to metadata
        scriptChunks.forEach((chunk, index) => {
          metadata[`script_chunk_${index}`] = chunk;
        });
        metadata.script_chunks_count = scriptChunks.length.toString();
      }
    }

    // ── Friends & Family: skip Stripe if applicable ──
    if (!userId.includes('@')) {
      const ffTier = await getUserFFTier(userId);
      if (ffTier) {
        const cogsCents = calculateAICost({ scriptLength, voiceProvider: builderState.voice.provider }).totalCents;
        const shouldSkipStripe = ffTier === 'inner_circle' || cogsCents < 50; // Stripe min $0.50

        if (shouldSkipStripe) {
          const { purchaseId, trackId } = await createFreeTrack({
            userId,
            trackConfig,
            cogsCents,
            ffTier,
          });
          console.log(`[F&F] Free track created for ${ffTier} user:`, { purchaseId, trackId });

          // Clean up pending track if we stored one
          if (pendingTrackId) {
            await supabaseAdmin.from('pending_tracks').delete().eq('id', pendingTrackId);
          }

          return NextResponse.json({
            skipStripe: true,
            redirectTo: `${successUrl.replace('{CHECKOUT_SESSION_ID}', `ff_${purchaseId}`)}`,
            purchaseId,
            trackId,
          });
        }

        // cost_pass with COGS >= $0.50: override price to COGS value, zero out voice fee
        priceAmount = cogsCents;
        // Voice fee is retail markup — F&F doesn't pay it
        // Update lineItems to reflect cost-pass pricing
        lineItems[0].price_data!.unit_amount = cogsCents;
        if (lineItems.length > 1) {
          lineItems.splice(1); // Remove voice fee line item
        }
      }
    }

    // Create Stripe checkout session
    // If returning customer, pass their Stripe customer ID for Stripe Link pre-fill
    const customerParams: Partial<Stripe.Checkout.SessionCreateParams> = stripeCustomerId
      ? { customer: stripeCustomerId }
      : { customer_creation: 'always' as const };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      ...customerParams,
      payment_intent_data: {
        setup_future_usage: 'off_session',
      },
      payment_method_types: ['card', 'link'],
      expires_at: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
      // Collect email for account creation (skip if returning customer)
      customer_email: undefined,
      billing_address_collection: 'auto',
      // Enable promotional codes
      allow_promotion_codes: true,
      // Custom fields to collect additional info
      custom_fields: [
        {
          key: 'preferred_name',
          label: {
            type: 'custom',
            custom: 'What should we call you?',
          },
          type: 'text',
          optional: true,
        },
      ],
      // Invoice settings — use minimal metadata to avoid 500 char limit
      invoice_creation: {
        enabled: true,
        invoice_data: {
          description: 'MindScript First Track Purchase',
          metadata: {
            user_id: metadata.user_id,
            pending_track_id: metadata.pending_track_id || '',
            is_first_purchase: metadata.is_first_purchase,
            voice_tier: metadata.voice_tier,
            total_amount: metadata.total_amount,
          },
        },
      },
    });

    // Return the session details
    return NextResponse.json({
      sessionId: session.id,
      url: session.url!,
      expiresAt: new Date(session.expires_at * 1000).toISOString(),
    });

  } catch (error) {
    console.error("Error creating guest checkout session:", error);

    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: `Stripe error: ${error.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
