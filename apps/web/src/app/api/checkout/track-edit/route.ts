import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TrackEditCheckoutSchema = z.object({
  trackId: z.string().uuid(),
  userId: z.string(),
  editData: z.object({
    gains: z.object({
      voiceDb: z.number(),
      musicDb: z.number(),
      solfeggioDb: z.number(),
      binauralDb: z.number(),
    }),
    voiceSpeed: z.number().min(0.5).max(1.5).optional(),
    solfeggio: z.object({
      enabled: z.boolean(),
      frequency: z.number().optional(),
    }).optional(),
    binaural: z.object({
      enabled: z.boolean(),
      band: z.string().optional(),
    }).optional(),
    duration: z.number().optional(),
    loop: z.object({
      enabled: z.boolean(),
      pause_seconds: z.number(),
    }).optional(),
  }),
  totalFeeCents: z.number(),
  successUrl: z.string(),
  cancelUrl: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = TrackEditCheckoutSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { trackId, userId, editData, totalFeeCents, successUrl, cancelUrl } = validation.data;

    // Stripe minimum charge is $0.50 USD
    if (totalFeeCents < 50) {
      return NextResponse.json(
        { error: 'Amount below Stripe minimum ($0.50)' },
        { status: 400 }
      );
    }

    // Look up existing Stripe customer for fast checkout
    let stripeCustomerId: string | undefined;
    if (!userId.includes('@')) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', userId)
        .single();
      stripeCustomerId = profile?.stripe_customer_id ?? undefined;
    }

    const customerParams: Partial<Stripe.Checkout.SessionCreateParams> = stripeCustomerId
      ? { customer: stripeCustomerId }
      : { customer_creation: 'always' as const };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: totalFeeCents,
            product_data: {
              name: 'Track Edit',
              description: 'Re-render track with updated settings',
              metadata: { type: 'track_edit', track_id: trackId },
            },
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        type: 'track_edit',
        track_id: trackId,
        user_id: userId,
        edit_data: JSON.stringify(editData),
      },
      ...customerParams,
      payment_method_types: ['card', 'link'],
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url!,
    });
  } catch (error) {
    console.error('[TRACK-EDIT-CHECKOUT] Error:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
