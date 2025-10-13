import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase, getUser } from '../../../../lib/supabase/server';
import Stripe from 'stripe';
import { z } from 'zod';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any,
});

// Request validation
const CheckoutSchema = z.object({
  trackConfig: z.any().optional(),
});

// GET endpoint for redirects from auth flow
export async function GET(request: NextRequest) {
  console.log('[CHECKOUT] GET request received');

  const searchParams = request.nextUrl.searchParams;
  const trackId = searchParams.get('track_id');

  if (!trackId) {
    return NextResponse.redirect(new URL('/builder', request.url));
  }

  // Get authenticated user
  const user = await getUser();
  console.log('[CHECKOUT] User from session:', user ? user.id : 'NO USER');

  if (!user) {
    console.error('[CHECKOUT] No authenticated user, redirecting to login');
    const url = new URL('/auth/login', request.url);
    url.searchParams.set('next', request.url);
    return NextResponse.redirect(url);
  }

  try {
    const supabase = await serverSupabase();

    // Get pending track config
    const { data: pendingTrack, error: trackError } = await supabase
      .from('pending_tracks')
      .select('track_config')
      .eq('id', trackId)
      .single();

    if (trackError || !pendingTrack) {
      console.error('[CHECKOUT] Failed to get pending track:', trackError);
      console.error('[CHECKOUT] Track ID:', trackId);
      return NextResponse.redirect(new URL('/builder?error=track_not_found', request.url));
    }

    console.log('[CHECKOUT] Found pending track for ID:', trackId);

    // Check for first-time discount
    const { count } = await supabase
      .from('purchases')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const isFirstPurchase = count === 0;
    console.log('[CHECKOUT] User', user.id, 'first purchase:', isFirstPurchase);

    // Create line items based on track config
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    // Base track price (with first-time discount)
    const basePrice = isFirstPurchase ? 100 : 3900; // $1 vs $39 in cents
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'Custom Audio Track',
          description: isFirstPurchase ? 'First Track - Special Pricing' : 'Custom Audio Track',
        },
        unit_amount: basePrice,
      },
      quantity: 1,
    });

    // Add any additional items from track config
    const trackConfig = pendingTrack.track_config;
    if (trackConfig?.backgroundMusic && trackConfig.backgroundMusic.price > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Background Music: ${trackConfig.backgroundMusic.name}`,
            description: 'Premium background music',
          },
          unit_amount: Math.round(trackConfig.backgroundMusic.price * 100),
        },
        quantity: 1,
      });
    }

    if (trackConfig?.solfeggio?.enabled && trackConfig.solfeggio.price > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Solfeggio Frequency: ${trackConfig.solfeggio.frequency} Hz`,
            description: 'Healing frequency overlay',
          },
          unit_amount: Math.round(trackConfig.solfeggio.price * 100),
        },
        quantity: 1,
      });
    }

    if (trackConfig?.binaural?.enabled && trackConfig.binaural.price > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Binaural Beats: ${trackConfig.binaural.band}`,
            description: 'Brainwave entrainment',
          },
          unit_amount: Math.round(trackConfig.binaural.price * 100),
        },
        quantity: 1,
      });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin}/checkout/success?cs={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin}/builder`,
      customer_email: user.email,
      metadata: {
        user_id: user.id,
        track_id: trackId,
        track_config: JSON.stringify(trackConfig),
        is_first_purchase: isFirstPurchase.toString(),
      },
    });

    console.log('[CHECKOUT] Created Stripe session:', session.id);

    // Redirect to Stripe Checkout
    return NextResponse.redirect(session.url!);

  } catch (error: any) {
    console.error('[CHECKOUT] Error creating checkout session:', error);
    return NextResponse.redirect(new URL('/builder?error=checkout_failed', request.url));
  }
}

// POST endpoint for programmatic creation
export async function POST(request: NextRequest) {
  console.log('[CHECKOUT] POST request received');

  // Get authenticated user
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = CheckoutSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { trackConfig } = validation.data;
    const supabase = await serverSupabase();

    // Check for first-time discount
    const { count } = await supabase
      .from('purchases')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const isFirstPurchase = count === 0;
    console.log('[CHECKOUT] User', user.id, 'first purchase:', isFirstPurchase);

    // Create line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    // Base track price
    const basePrice = isFirstPurchase ? 100 : 3900; // $1 vs $39 in cents
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'Custom Audio Track',
          description: isFirstPurchase ? 'First Track - Special Pricing' : 'Custom Audio Track',
        },
        unit_amount: basePrice,
      },
      quantity: 1,
    });

    // Add additional items if configured
    if (trackConfig?.backgroundMusic && trackConfig.backgroundMusic.price > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Background Music: ${trackConfig.backgroundMusic.name}`,
            description: 'Premium background music',
          },
          unit_amount: Math.round(trackConfig.backgroundMusic.price * 100),
        },
        quantity: 1,
      });
    }

    if (trackConfig?.solfeggio?.enabled && trackConfig.solfeggio.price > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Solfeggio Frequency: ${trackConfig.solfeggio.frequency} Hz`,
            description: 'Healing frequency overlay',
          },
          unit_amount: Math.round(trackConfig.solfeggio.price * 100),
        },
        quantity: 1,
      });
    }

    if (trackConfig?.binaural?.enabled && trackConfig.binaural.price > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Binaural Beats: ${trackConfig.binaural.band}`,
            description: 'Brainwave entrainment',
          },
          unit_amount: Math.round(trackConfig.binaural.price * 100),
        },
        quantity: 1,
      });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin}/checkout/success?cs={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin}/builder`,
      customer_email: user.email,
      metadata: {
        user_id: user.id,
        track_config: JSON.stringify(trackConfig || {}),
        is_first_purchase: isFirstPurchase.toString(),
      },
    });

    console.log('[CHECKOUT] Created Stripe session:', session.id);

    return NextResponse.json({
      url: session.url,
      sessionId: session.id
    });

  } catch (error: any) {
    console.error('[CHECKOUT] Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}