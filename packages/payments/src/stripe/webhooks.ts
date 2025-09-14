import Stripe from "stripe";
import { SupabaseClient } from "@supabase/supabase-js";

export interface WebhookConfig {
  stripe: Stripe;
  supabase: SupabaseClient;
  webhookSecret: string;
}

export interface ProcessWebhookResult {
  success: boolean;
  duplicate?: boolean;
  error?: string;
}

/**
 * Verify Stripe webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
  stripe: Stripe
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

/**
 * Check if a webhook event has already been processed (idempotency)
 */
export async function checkEventDuplicate(
  eventId: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const { data: existingEvent } = await supabase
    .from("webhook_events")
    .select("id, status")
    .eq("stripe_event_id", eventId)
    .single();

  return existingEvent?.status === "processed";
}

/**
 * Record a webhook event for idempotency
 */
export async function recordWebhookEvent(
  event: Stripe.Event,
  supabase: SupabaseClient,
  status: "processing" | "processed" | "failed" = "processing"
): Promise<void> {
  await supabase.from("webhook_events").upsert({
    stripe_event_id: event.id,
    type: event.type,
    data: event,
    status,
    processed_at: new Date().toISOString(),
  }, {
    onConflict: "stripe_event_id",
  });
}

/**
 * Update webhook event status
 */
export async function updateWebhookStatus(
  eventId: string,
  status: "processed" | "failed",
  supabase: SupabaseClient,
  error?: string
): Promise<void> {
  const update: any = { status };
  if (error) {
    update.error = error;
  }

  await supabase
    .from("webhook_events")
    .update(update)
    .eq("stripe_event_id", eventId);
}

/**
 * Process checkout.session.completed event
 */
export async function processCheckoutCompleted(
  session: Stripe.Checkout.Session,
  supabase: SupabaseClient
): Promise<void> {
  const itemCount = parseInt(session.metadata?.itemCount || "0", 10);
  const userId = session.metadata?.userId === "guest" ? null : session.metadata?.userId;
  const sessionId = session.client_reference_id || `session_${session.id}`;

  // Create purchase record
  const { data: purchase, error: purchaseError } = await supabase
    .from("purchases")
    .insert({
      user_id: userId,
      session_id: sessionId,
      stripe_payment_intent_id: session.payment_intent as string,
      stripe_checkout_session_id: session.id,
      amount_total: session.amount_total || 0,
      currency: session.currency?.toUpperCase() || "USD",
      status: "processing",
      metadata: session.metadata,
    })
    .select()
    .single();

  if (purchaseError) {
    throw new Error(`Failed to create purchase: ${purchaseError.message}`);
  }

  // Process each item
  for (let i = 0; i < itemCount; i++) {
    const itemMetadata = session.metadata?.[`item_${i}`];
    if (!itemMetadata) continue;

    const item = JSON.parse(itemMetadata);
    
    // Create purchase item
    await supabase.from("purchase_items").insert({
      purchase_id: purchase.id,
      track_id: item.trackId,
      seller_id: item.sellerId,
      price: item.price,
      platform_fee: item.platformFee,
      seller_earnings: item.sellerEarnings,
    });

    // Grant track access
    await supabase.from("track_access").insert({
      user_id: userId,
      session_id: sessionId,
      track_id: item.trackId,
      purchase_id: purchase.id,
      access_type: "purchase",
    });

    // Create earnings ledger entry
    await supabase.from("earnings_ledger").insert({
      purchase_id: purchase.id,
      seller_id: item.sellerId,
      track_id: item.trackId,
      gross_cents: item.price,
      platform_fee_cents: item.platformFee,
      processing_fee_cents: Math.round(item.price * 0.029 + 30),
      seller_cut_cents: item.sellerEarnings,
      status: "pending",
    });
  }

  // Update purchase status
  await supabase
    .from("purchases")
    .update({
      status: "succeeded",
      completed_at: new Date().toISOString(),
    })
    .eq("id", purchase.id);
}

/**
 * Process charge.refunded event
 */
export async function processRefund(
  charge: Stripe.Charge,
  supabase: SupabaseClient
): Promise<void> {
  const refundAmount = charge.amount_refunded;
  const isFullRefund = charge.amount === charge.amount_refunded;
  
  // Update purchase status
  const { data: purchase } = await supabase
    .from("purchases")
    .update({
      status: isFullRefund ? "refunded" : "succeeded",
      refunded_at: new Date().toISOString(),
      refund_amount: refundAmount,
    })
    .eq("stripe_payment_intent_id", charge.payment_intent)
    .select()
    .single();

  if (purchase && isFullRefund) {
    // Revoke access for full refunds
    await supabase
      .from("track_access")
      .update({
        revoked_at: new Date().toISOString(),
      })
      .eq("purchase_id", purchase.id);

    // Update earnings ledger
    await supabase
      .from("earnings_ledger")
      .update({
        status: "refunded",
      })
      .eq("purchase_id", purchase.id);
  }
}

/**
 * Main webhook processor with error handling and idempotency
 */
export async function processWebhook(
  payload: string | Buffer,
  signature: string,
  config: WebhookConfig
): Promise<ProcessWebhookResult> {
  const { stripe, supabase, webhookSecret } = config;

  // Verify signature
  let event: Stripe.Event;
  try {
    event = verifyWebhookSignature(payload, signature, webhookSecret, stripe);
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return {
      success: false,
      error: "Invalid webhook signature",
    };
  }

  // Check for duplicate
  const isDuplicate = await checkEventDuplicate(event.id, supabase);
  if (isDuplicate) {
    console.log(`Duplicate webhook event ${event.id}, skipping`);
    return {
      success: true,
      duplicate: true,
    };
  }

  // Record the event
  await recordWebhookEvent(event, supabase, "processing");

  try {
    // Process based on event type
    switch (event.type) {
      case "checkout.session.completed":
        await processCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
          supabase
        );
        break;

      case "charge.refunded":
        await processRefund(
          event.data.object as Stripe.Charge,
          supabase
        );
        break;

      // Add more event handlers as needed
      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }

    // Mark as processed
    await updateWebhookStatus(event.id, "processed", supabase);
    
    return { success: true };

  } catch (error) {
    console.error("Webhook processing error:", error);
    
    // Mark as failed
    await updateWebhookStatus(
      event.id,
      "failed",
      supabase,
      error instanceof Error ? error.message : "Unknown error"
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : "Processing failed",
    };
  }
}