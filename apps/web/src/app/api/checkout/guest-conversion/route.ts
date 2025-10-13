import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

// Request validation schema
const GuestCheckoutRequestSchema = z.object({
  userId: z.string(), // User ID or email from authenticated session
  builderState: z.object({
    script: z.string(),
    voice: z.object({
      provider: z.enum(['openai', 'elevenlabs']),
      voice_id: z.string(),
      name: z.string(),
    }),
    duration: z.number(),
    backgroundMusic: z.object({
      id: z.string(),
      name: z.string(),
      price: z.number(),
    }).optional(),
    solfeggio: z.object({
      enabled: z.boolean(),
      frequency: z.number(),
      price: z.number(),
    }).optional(),
    binaural: z.object({
      enabled: z.boolean(),
      band: z.enum(['delta', 'theta', 'alpha', 'beta', 'gamma']),
      price: z.number(),
    }).optional(),
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
    if (builderState.backgroundMusic && builderState.backgroundMusic.id !== 'none') {
      features.push(`Background Music: ${builderState.backgroundMusic.name}`);
    }
    if (builderState.solfeggio?.enabled) {
      features.push(`Solfeggio: ${builderState.solfeggio.frequency} Hz`);
    }
    if (builderState.binaural?.enabled) {
      features.push(`Binaural: ${builderState.binaural.band}`);
    }

    const description = `${builderState.duration} min track with ${builderState.voice.name}${features.length > 0 ? ` • ${features.join(' • ')}` : ''}`;

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
              has_background_music: (!!builderState.backgroundMusic && builderState.backgroundMusic.id !== 'none').toString(),
              has_solfeggio: (!!builderState.solfeggio?.enabled).toString(),
              has_binaural: (!!builderState.binaural?.enabled).toString(),
            },
          },
        },
        quantity: 1,
      },
    ];

    // Store builder state in metadata (Stripe has a 500 character limit per value)
    // We'll split the data across multiple metadata fields
    const scriptChunks = builderState.script.match(/.{1,400}/g) || [];
    const metadata: Record<string, string> = {
      user_id: userId, // Critical for webhook - can be UUID or email
      user_email: userId.includes('@') ? userId : '', // Store email separately if that's what we have
      conversion_type: 'guest_to_user',
      first_track_discount_used: firstTrackDiscount.toString(), // Track discount usage
      first_track: 'true',
      voice_provider: builderState.voice.provider,
      voice_id: builderState.voice.voice_id,
      voice_name: builderState.voice.name,
      duration: builderState.duration.toString(),
      total_amount: priceAmount.toString(),
    };

    // Add script chunks to metadata
    scriptChunks.forEach((chunk, index) => {
      metadata[`script_chunk_${index}`] = chunk;
    });
    metadata.script_chunks_count = scriptChunks.length.toString();

    // Add optional features to metadata
    if (builderState.backgroundMusic) {
      metadata.background_music_id = builderState.backgroundMusic.id;
      metadata.background_music_name = builderState.backgroundMusic.name;
    }

    if (builderState.solfeggio?.enabled) {
      metadata.solfeggio_frequency = builderState.solfeggio.frequency.toString();
    }

    if (builderState.binaural?.enabled) {
      metadata.binaural_band = builderState.binaural.band;
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