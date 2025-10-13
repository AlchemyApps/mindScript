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
    const trackId = metadata.track_id;
    const trackConfigStr = metadata.track_config;
    const isFirstPurchase = metadata.is_first_purchase === 'true';

    if (!userId) {
      console.error('[LOCAL-TRIGGER] Missing user_id in session metadata');
      return NextResponse.json(
        { error: 'Missing user_id in session metadata' },
        { status: 400 }
      );
    }

    console.log('[LOCAL-TRIGGER] Processing purchase for user:', userId);

    // Parse track config if provided
    let trackConfig = {};
    if (trackConfigStr) {
      try {
        trackConfig = JSON.parse(trackConfigStr);
      } catch (e) {
        console.error('[LOCAL-TRIGGER] Failed to parse track config:', e);
      }
    }

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
            track_id: trackId
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
    if (trackConfigStr && purchase) {
      try {
        const builtTrackId = await startTrackBuild({
          userId,
          purchaseId: purchase.id,
          trackConfig
        });

        console.log('[LOCAL-TRIGGER] Track build started:', builtTrackId);
      } catch (error) {
        console.error('[LOCAL-TRIGGER] Failed to start track build:', error);
        // Don't fail the entire request - we can retry the build later
      }
    }

    // Clean up pending track if it exists
    if (trackId) {
      await supabaseAdmin
        .from('pending_tracks')
        .delete()
        .eq('id', trackId);

      console.log('[LOCAL-TRIGGER] Cleaned up pending track:', trackId);
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
