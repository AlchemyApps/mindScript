import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

// Request validation schema
const GuestCheckoutRequestSchema = z.object({
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
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = GuestCheckoutRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { builderState, successUrl, cancelUrl, priceAmount } = validationResult.data;

    // Create line items for the checkout session
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: 'usd',
          unit_amount: 99, // Base price $0.99
          product_data: {
            name: 'MindScript First Track',
            description: `${builderState.duration} minute personalized audio track`,
            metadata: {
              type: 'base_track',
            },
          },
        },
        quantity: 1,
      },
    ];

    // Add background music if selected
    if (builderState.backgroundMusic && builderState.backgroundMusic.id !== 'none') {
      lineItems.push({
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(builderState.backgroundMusic.price * 100),
          product_data: {
            name: `Background Music: ${builderState.backgroundMusic.name}`,
            description: 'Premium background music for your track',
            metadata: {
              type: 'background_music',
              music_id: builderState.backgroundMusic.id,
            },
          },
        },
        quantity: 1,
      });
    }

    // Add Solfeggio frequency if enabled
    if (builderState.solfeggio?.enabled) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(builderState.solfeggio.price * 100),
          product_data: {
            name: `Solfeggio Frequency: ${builderState.solfeggio.frequency} Hz`,
            description: 'Healing frequency overlay',
            metadata: {
              type: 'solfeggio',
              frequency: builderState.solfeggio.frequency.toString(),
            },
          },
        },
        quantity: 1,
      });
    }

    // Add Binaural beats if enabled
    if (builderState.binaural?.enabled) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(builderState.binaural.price * 100),
          product_data: {
            name: `Binaural Beats: ${builderState.binaural.band.charAt(0).toUpperCase() + builderState.binaural.band.slice(1)} Band`,
            description: 'Brainwave entrainment',
            metadata: {
              type: 'binaural',
              band: builderState.binaural.band,
            },
          },
        },
        quantity: 1,
      });
    }

    // Store builder state in metadata (Stripe has a 500 character limit per value)
    // We'll split the data across multiple metadata fields
    const scriptChunks = builderState.script.match(/.{1,400}/g) || [];
    const metadata: Record<string, string> = {
      conversion_type: 'guest_to_user',
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