// Deno Edge Function for handling Stripe webhooks
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@14.10.0";

// Initialize Stripe with secret key
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

// Stripe processing fee estimation (2.9% + 30¢)
const STRIPE_PERCENTAGE_FEE = 0.029;
const STRIPE_FIXED_FEE_CENTS = 30;

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface WebhookEvent {
  id: string;
  provider: string;
  event_id: string;
  event_type: string;
  payload: unknown;
  signature: string;
  processed: boolean;
  processed_at?: string;
  error_message?: string;
  retry_count: number;
  created_at: string;
}

/**
 * Calculate processing fees for a given amount
 */
function calculateProcessingFees(amountCents: number): number {
  return Math.round(amountCents * STRIPE_PERCENTAGE_FEE + STRIPE_FIXED_FEE_CENTS);
}

/**
 * Structured logging helper
 */
function log(level: "info" | "warn" | "error", message: string, context?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...context,
  };
  console.log(JSON.stringify(logEntry));
}

/**
 * Main webhook handler
 */
async function handleWebhook(req: Request): Promise<Response> {
  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get request body and signature
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    log("error", "Missing stripe-signature header");
    return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verify webhook signature
  let event: Stripe.Event;
  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET not configured");
    }

    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    log("info", "Webhook signature verified", { eventId: event.id, eventType: event.type });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    log("error", "Webhook signature verification failed", { error: errorMessage });
    return new Response(JSON.stringify({ error: "Invalid webhook signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Check for duplicate event (idempotency)
  const { data: existingEvent, error: fetchError } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("provider", "stripe")
    .eq("event_id", event.id)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    // PGRST116 means no rows found, which is expected for new events
    log("error", "Failed to check for duplicate event", { error: fetchError.message });
    return new Response(JSON.stringify({ error: "Database error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (existingEvent) {
    log("info", "Duplicate webhook event, skipping", { eventId: event.id });
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Record the webhook event
  const { error: insertError } = await supabase.from("webhook_events").insert({
    provider: "stripe",
    event_id: event.id,
    event_type: event.type,
    payload: event,
    signature: signature,
    processed: false,
    retry_count: 0,
  });

  if (insertError) {
    log("error", "Failed to record webhook event", { error: insertError.message });
    return new Response(JSON.stringify({ error: "Failed to record event" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Process different event types
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutSessionCompleted(event, supabase);
        break;
      }

      case "account.updated": {
        await handleAccountUpdated(event, supabase);
        break;
      }

      case "transfer.created": {
        await handleTransferCreated(event, supabase);
        break;
      }

      case "transfer.paid": {
        await handleTransferPaid(event, supabase);
        break;
      }

      case "transfer.failed": {
        await handleTransferFailed(event, supabase);
        break;
      }

      case "charge.refunded": {
        await handleChargeRefunded(event, supabase);
        break;
      }

      default:
        log("info", "Unhandled webhook event type", { eventType: event.type });
    }

    // Mark event as processed
    await supabase
      .from("webhook_events")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq("provider", "stripe")
      .eq("event_id", event.id);

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log("error", "Webhook processing error", { error: errorMessage, eventId: event.id });

    // Update event with error
    await supabase
      .from("webhook_events")
      .update({
        error_message: errorMessage,
        retry_count: 1,
      })
      .eq("provider", "stripe")
      .eq("event_id", event.id);

    // Return success to avoid immediate Stripe retries for processing errors
    // We'll handle retries on our end
    return new Response(JSON.stringify({ received: true, error: "Processing failed" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutSessionCompleted(
  event: Stripe.Event,
  supabase: ReturnType<typeof createClient>
) {
  const session = event.data.object as Stripe.Checkout.Session;

  // Extract metadata
  const userId = session.metadata?.userId;
  const trackId = session.metadata?.trackId;
  const sellerId = session.metadata?.sellerId;

  if (!userId || !trackId || !sellerId) {
    throw new Error("Missing required metadata in checkout session");
  }

  log("info", "Processing checkout session", { sessionId: session.id, userId, trackId, sellerId });

  // Get seller's platform fee percentage
  const { data: sellerAgreement, error: agreementError } = await supabase
    .from("seller_agreements")
    .select("platform_fee_percent")
    .eq("user_id", sellerId)
    .single();

  if (agreementError) {
    log("warn", "Failed to fetch seller agreement", { error: agreementError.message, sellerId });
  }

  const platformFeePercent = sellerAgreement?.platform_fee_percent || 15;
  const amountCents = session.amount_total || 0;
  const processingFeeCents = calculateProcessingFees(amountCents);
  const platformFeeCents = Math.round(amountCents * (platformFeePercent / 100));
  const sellerEarningsCents = amountCents - processingFeeCents - platformFeeCents;

  // Create purchase record
  const { data: purchase, error: purchaseError } = await supabase
    .from("purchases")
    .insert({
      buyer_id: userId,
      track_id: trackId,
      seller_id: sellerId,
      platform: "web",
      sale_price_cents: amountCents,
      currency: session.currency?.toUpperCase() || "USD",
      status: "paid",
      stripe_payment_intent_id: session.payment_intent as string,
      stripe_checkout_session_id: session.id,
      seller_share_cents: sellerEarningsCents,
      platform_fee_cents: platformFeeCents,
      processor_fee_cents: processingFeeCents,
    })
    .select()
    .single();

  if (purchaseError) {
    throw new Error(`Failed to create purchase: ${purchaseError.message}`);
  }

  // Create earnings ledger entry
  const { error: ledgerError } = await supabase.from("earnings_ledger").insert({
    seller_id: sellerId,
    purchase_id: purchase.id,
    track_id: trackId,
    gross_cents: amountCents,
    processor_fee_cents: processingFeeCents,
    platform_fee_cents: platformFeeCents,
    seller_earnings_cents: sellerEarningsCents,
    currency: session.currency?.toUpperCase() || "USD",
    channel: "web",
    payout_status: "pending",
  });

  if (ledgerError) {
    log("error", "Failed to create earnings ledger entry", { error: ledgerError.message });
  }

  log("info", "Checkout session processed successfully", { purchaseId: purchase.id });
}

/**
 * Handle account.updated event
 */
async function handleAccountUpdated(
  event: Stripe.Event,
  supabase: ReturnType<typeof createClient>
) {
  const account = event.data.object as Stripe.Account;

  log("info", "Processing account update", { accountId: account.id });

  // Update seller agreement with latest Connect account status
  const status = account.charges_enabled && account.payouts_enabled
    ? "active"
    : account.details_submitted
    ? "onboarding_incomplete"
    : "pending_onboarding";

  const { error } = await supabase
    .from("seller_agreements")
    .update({
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      status,
      onboarding_completed_at: status === "active" ? new Date().toISOString() : null,
      business_name: account.business_profile?.name || null,
      country: account.country || null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_connect_account_id", account.id);

  if (error) {
    throw new Error(`Failed to update seller agreement: ${error.message}`);
  }

  log("info", "Account update processed successfully", { accountId: account.id, status });
}

/**
 * Handle transfer.created event
 */
async function handleTransferCreated(
  event: Stripe.Event,
  supabase: ReturnType<typeof createClient>
) {
  const transfer = event.data.object as Stripe.Transfer;

  log("info", "Processing transfer created", { transferId: transfer.id });

  const sellerId = transfer.metadata?.sellerId;
  if (!sellerId) {
    log("warn", "Transfer missing sellerId metadata", { transferId: transfer.id });
    return;
  }

  // Create payout record
  const { data: payout, error: payoutError } = await supabase
    .from("payouts")
    .insert({
      seller_id: sellerId,
      stripe_transfer_id: transfer.id,
      amount_cents: transfer.amount,
      currency: transfer.currency.toUpperCase(),
      status: "processing",
      period_start: transfer.metadata?.periodStart || null,
      period_end: transfer.metadata?.periodEnd || null,
      initiated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (payoutError) {
    throw new Error(`Failed to create payout record: ${payoutError.message}`);
  }

  // Update earnings ledger entries for this payout
  if (transfer.metadata?.periodStart && transfer.metadata?.periodEnd) {
    const { error: ledgerError } = await supabase
      .from("earnings_ledger")
      .update({
        payout_id: payout.id,
        payout_status: "processing",
        payout_date: new Date().toISOString(),
      })
      .eq("seller_id", sellerId)
      .eq("payout_status", "pending")
      .gte("created_at", transfer.metadata.periodStart)
      .lte("created_at", transfer.metadata.periodEnd);

    if (ledgerError) {
      log("error", "Failed to update earnings ledger", { error: ledgerError.message });
    }
  }

  log("info", "Transfer created processed successfully", { payoutId: payout.id });
}

/**
 * Handle transfer.paid event
 */
async function handleTransferPaid(
  event: Stripe.Event,
  supabase: ReturnType<typeof createClient>
) {
  const transfer = event.data.object as Stripe.Transfer;

  log("info", "Processing transfer paid", { transferId: transfer.id });

  // Update payout status to completed
  const { error: updateError } = await supabase
    .from("payouts")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("stripe_transfer_id", transfer.id);

  if (updateError) {
    throw new Error(`Failed to update payout status: ${updateError.message}`);
  }

  // Get payout ID and update earnings ledger
  const { data: payout, error: fetchError } = await supabase
    .from("payouts")
    .select("id")
    .eq("stripe_transfer_id", transfer.id)
    .single();

  if (fetchError) {
    log("error", "Failed to fetch payout", { error: fetchError.message });
    return;
  }

  if (payout) {
    const { error: ledgerError } = await supabase
      .from("earnings_ledger")
      .update({
        payout_status: "paid",
      })
      .eq("payout_id", payout.id);

    if (ledgerError) {
      log("error", "Failed to update earnings ledger", { error: ledgerError.message });
    }
  }

  log("info", "Transfer paid processed successfully", { transferId: transfer.id });
}

/**
 * Handle transfer.failed event
 */
async function handleTransferFailed(
  event: Stripe.Event,
  supabase: ReturnType<typeof createClient>
) {
  const transfer = event.data.object as Stripe.Transfer;

  log("info", "Processing transfer failed", { transferId: transfer.id });

  // Update payout status to failed
  const { error: updateError } = await supabase
    .from("payouts")
    .update({
      status: "failed",
      failure_reason: "Transfer failed",
    })
    .eq("stripe_transfer_id", transfer.id);

  if (updateError) {
    throw new Error(`Failed to update payout status: ${updateError.message}`);
  }

  // Reset earnings ledger entries
  const { data: payout, error: fetchError } = await supabase
    .from("payouts")
    .select("id")
    .eq("stripe_transfer_id", transfer.id)
    .single();

  if (fetchError) {
    log("error", "Failed to fetch payout", { error: fetchError.message });
    return;
  }

  if (payout) {
    const { error: ledgerError } = await supabase
      .from("earnings_ledger")
      .update({
        payout_id: null,
        payout_status: "pending",
        payout_date: null,
      })
      .eq("payout_id", payout.id);

    if (ledgerError) {
      log("error", "Failed to reset earnings ledger", { error: ledgerError.message });
    }
  }

  log("info", "Transfer failed processed successfully", { transferId: transfer.id });
}

/**
 * Handle charge.refunded event
 */
async function handleChargeRefunded(
  event: Stripe.Event,
  supabase: ReturnType<typeof createClient>
) {
  const charge = event.data.object as Stripe.Charge;

  log("info", "Processing charge refund", { chargeId: charge.id });

  // Update purchase status
  const { error } = await supabase
    .from("purchases")
    .update({
      status: charge.refunded ? "refunded" : "partially_refunded",
      refunded_at: new Date().toISOString(),
      refund_amount: charge.amount_refunded,
    })
    .eq("stripe_payment_intent_id", charge.payment_intent);

  if (error) {
    throw new Error(`Failed to update purchase status: ${error.message}`);
  }

  // TODO: Implement refund adjustments in earnings ledger
  // This would involve creating negative ledger entries or adjusting existing ones

  log("info", "Charge refund processed successfully", { chargeId: charge.id, refundAmount: charge.amount_refunded });
}

// Start the server
serve(handleWebhook);