import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import Stripe from "stripe";
import { startTrackBuild } from "../../../lib/track-builder";

// Set runtime to Node.js for raw body access
export const runtime = 'nodejs';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

// Create Supabase admin client for webhooks
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
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events with idempotency
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    // DEVELOPMENT ONLY: Skip signature verification if no webhook secret is configured
    if (process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_WEBHOOK_SECRET !== 'whsec_test_secret_placeholder_replace_me') {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } else {
      // WARNING: Only for development! Parse event without verification
      console.warn('[WEBHOOK] Running without signature verification - DEVELOPMENT ONLY');
      event = JSON.parse(body) as Stripe.Event;
    }
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
    created_at: new Date().toISOString()
  });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Only process if payment is complete
        if (session.payment_status !== 'paid') {
          console.log('[WEBHOOK] Session not paid, skipping:', session.id);
          return NextResponse.json({ received: true });
        }

        const metadata = session.metadata || {};
        const userId = metadata.user_id;
        const trackId = metadata.track_id;
        const trackConfigStr = metadata.track_config;
        const isFirstPurchase = metadata.is_first_purchase === 'true';

        if (!userId) {
          console.error('[WEBHOOK] Missing user_id in session metadata');
          break;
        }

        console.log('[WEBHOOK] Processing purchase for user:', userId);

        // Parse track config if provided
        let trackConfig = {};
        if (trackConfigStr) {
          try {
            trackConfig = JSON.parse(trackConfigStr);
          } catch (e) {
            console.error('[WEBHOOK] Failed to parse track config:', e);
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
              console.log('[WEBHOOK] Purchase already exists for session:', session.id);
              return NextResponse.json({ received: true, duplicate: true });
            }
            throw error;
          }

          purchase = data;
          console.log('[WEBHOOK] Created purchase:', purchase.id);

        } catch (error: any) {
          console.error('[WEBHOOK] Failed to create purchase:', error);

          // If it's a unique constraint violation, the purchase was already processed
          if (error.code === '23505') {
            console.log('[WEBHOOK] Purchase already processed for session:', session.id);
            return NextResponse.json({ received: true, duplicate: true });
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

          console.log('[WEBHOOK] Marked first-track discount as used for user:', userId);
        }

        // Start track build if we have config
        if (trackConfigStr && purchase) {
          try {
            const trackId = await startTrackBuild({
              userId,
              purchaseId: purchase.id,
              trackConfig
            });

            console.log('[WEBHOOK] Track build started:', trackId);
          } catch (error) {
            console.error('[WEBHOOK] Failed to start track build:', error);
            // Don't fail the webhook - we can retry the build later
          }
        }

        // Clean up pending track if it exists
        if (trackId) {
          await supabaseAdmin
            .from('pending_tracks')
            .delete()
            .eq('id', trackId);

          console.log('[WEBHOOK] Cleaned up pending track:', trackId);
        }

        // TODO: Send purchase confirmation email
        // TODO: Trigger any additional post-purchase workflows

        console.log('[WEBHOOK] Successfully processed checkout.session.completed:', {
          sessionId: session.id,
          userId,
          purchaseId: purchase.id,
          isFirstPurchase
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