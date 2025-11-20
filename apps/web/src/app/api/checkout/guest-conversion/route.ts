import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

// Request validation schema - matches what BuilderForm actually sends
const GuestCheckoutRequestSchema = z.object({
  userId: z.string(), // User ID or email from authenticated session
  builderState: z.object({
    script: z.string(),
    voice: z.object({
      provider: z.enum(['openai', 'elevenlabs', 'uploaded']),
      voice_id: z.string(),
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

      // This is tricky because we can't directly query auth.users
      // For now, we'll use the email as the identifier in metadata
      // The webhook will need to handle this appropriately
      console.log('Using email as identifier:', userId);
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

    // Get voice name from voice_id (we'll need to map this properly in production)
    const voiceName = builderState.voice.voice_id.charAt(0).toUpperCase() + builderState.voice.voice_id.slice(1);
    const duration = builderState.duration || 10; // Default to 10 minutes if not specified
    const description = `${duration} min track with ${voiceName}${features.length > 0 ? ` • ${features.join(' • ')}` : ''}`;

    // Create single line item with total price (includes all add-ons)
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: 'usd',
          unit_amount: priceAmount, // Total price from frontend (already includes add-ons)
          product_data: {
            name: firstTrackDiscount ? 'MindScript First Track (Special Pricing)' : 'MindScript Track',
            description,
            metadata: {
              type: 'complete_track',
              has_background_music: (!!builderState.music?.id && builderState.music.id !== 'none').toString(),
              has_solfeggio: (!!builderState.solfeggio?.enabled).toString(),
              has_binaural: (!!builderState.binaural?.enabled).toString(),
            },
          },
        },
        quantity: 1,
      },
    ];

    // Create full track config for webhook processing
    const trackConfig = {
      title: `Track - ${new Date().toLocaleDateString()}`,
      script: builderState.script,
      voice: {
        provider: builderState.voice.provider,
        voice_id: builderState.voice.voice_id,
        name: voiceName, // Use the derived voice name
        settings: builderState.voice.settings || {}
      },
      duration: duration,
      backgroundMusic: builderState.music?.id && builderState.music.id !== 'none'
        ? {
            id: builderState.music.id,
            name: 'Background Music', // We'll need to look this up in production
            url: '', // Will be populated by the system
            volume_db: builderState.music.volume_db || -20
          }
        : null,
      solfeggio: builderState.solfeggio?.enabled ? {
        enabled: true,
        frequency: builderState.solfeggio.frequency || 528,
        volume_db: builderState.solfeggio.volume_db || -20
      } : null,
      binaural: builderState.binaural?.enabled ? {
        enabled: true,
        band: builderState.binaural.band || 'theta',
        volume_db: builderState.binaural.volume_db || -20
      } : null,
    };

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
      total_amount: priceAmount.toString(),
    };

    // Try to store full config if it fits, otherwise use chunking approach
    if (trackConfigStr.length <= 500) {
      metadata.track_config = trackConfigStr;
    } else {
      // Store config without script, then add script chunks separately
      const configWithoutScript = { ...trackConfig, script: '' };
      metadata.track_config_partial = JSON.stringify(configWithoutScript);

      // Add script chunks to metadata
      scriptChunks.forEach((chunk, index) => {
        metadata[`script_chunk_${index}`] = chunk;
      });
      metadata.script_chunks_count = scriptChunks.length.toString();
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      customer_creation: 'always', // Always create a customer
      payment_method_types: ['card'],
      expires_at: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
      // Collect email for account creation
      customer_email: undefined, // Let Stripe collect it
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
      // Invoice settings
      invoice_creation: {
        enabled: true,
        invoice_data: {
          description: 'MindScript First Track Purchase',
          metadata,
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