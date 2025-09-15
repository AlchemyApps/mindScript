/**
 * RevenueCat Webhook Handler for Supabase Edge Function
 *
 * Processes In-App Purchase events from RevenueCat including:
 * - Initial purchases and renewals
 * - Cancellations and expirations
 * - Product changes and billing issues
 *
 * Maintains idempotency and cross-platform synchronization
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://esm.sh/zod@3.22.4";

// Import schemas (these would be imported from @mindscript/schemas in production)
const RevenueCatWebhookEventSchema = z.object({
  api_version: z.string(),
  event: z.object({
    id: z.string().uuid(),
    type: z.enum([
      'INITIAL_PURCHASE',
      'RENEWAL',
      'CANCELLATION',
      'NON_RENEWING_PURCHASE',
      'EXPIRATION',
      'BILLING_ISSUE',
      'PRODUCT_CHANGE',
      'SUBSCRIBER_ALIAS',
      'UNCANCELLATION',
      'TRANSFER',
    ]),
    event_timestamp_ms: z.number(),
    app_id: z.string(),
    app_user_id: z.string(),
    original_app_user_id: z.string(),
    product_id: z.string(),
    price: z.number().optional(),
    currency: z.string().optional(),
    store: z.enum(['APP_STORE', 'PLAY_STORE', 'STRIPE', 'PROMOTIONAL', 'AMAZON']),
    environment: z.enum(['PRODUCTION', 'SANDBOX']),
    store_transaction_id: z.string().optional(),
    purchased_at_ms: z.number().optional(),
    expiration_at_ms: z.number().optional(),
    cancellation_reason: z.string().optional(),
    is_trial_conversion: z.boolean().optional(),
    subscriber_attributes: z.record(z.unknown()).optional(),
  }),
});

// Constants
const PLATFORM_FEE_RATE = 0.30; // 30% for App Store/Play Store
const MINDSCRIPT_FEE_RATE = 0.15; // 15% platform fee after store cut

// Initialize Supabase
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Product ID mapping
const PRODUCT_MAPPING: Record<string, { tier: string; billing: string; isIntro: boolean }> = {
  'mindscript_intro_monthly': { tier: 'starter', billing: 'monthly', isIntro: true },
  'mindscript_starter_monthly': { tier: 'starter', billing: 'monthly', isIntro: false },
  'mindscript_starter_yearly': { tier: 'starter', billing: 'yearly', isIntro: false },
  'mindscript_creator_monthly': { tier: 'creator', billing: 'monthly', isIntro: false },
  'mindscript_creator_yearly': { tier: 'creator', billing: 'yearly', isIntro: false },
  'mindscript_studio_monthly': { tier: 'studio', billing: 'monthly', isIntro: false },
  'mindscript_studio_yearly': { tier: 'studio', billing: 'yearly', isIntro: false },
  'mindscript_track_single': { tier: 'single', billing: 'once', isIntro: false },
  'mindscript_track_bundle_5': { tier: 'bundle_5', billing: 'once', isIntro: false },
  'mindscript_track_bundle_10': { tier: 'bundle_10', billing: 'once', isIntro: false },
};

/**
 * Structured logging helper
 */
function log(level: "info" | "warn" | "error", message: string, context?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    service: 'revenuecat-webhook',
    message,
    ...context,
  };
  console.log(JSON.stringify(logEntry));
}

/**
 * Verify RevenueCat webhook authorization
 */
function verifyAuthorization(authHeader: string | null): boolean {
  if (!authHeader) {
    return false;
  }

  const expectedToken = Deno.env.get("REVENUECAT_WEBHOOK_AUTH_TOKEN");
  if (!expectedToken) {
    log("error", "REVENUECAT_WEBHOOK_AUTH_TOKEN not configured");
    return false;
  }

  // RevenueCat sends: "Bearer YOUR_TOKEN"
  const token = authHeader.replace("Bearer ", "");
  return token === expectedToken;
}

/**
 * Map RevenueCat app_user_id to Supabase user_id
 * RevenueCat app_user_id can be either:
 * 1. The Supabase user ID (if set during SDK init)
 * 2. A RevenueCat anonymous ID (starts with $RCAnonymousID)
 * 3. A custom ID set by the app
 */
async function mapAppUserToSupabaseUser(
  appUserId: string,
  subscriberAttributes: Record<string, unknown> | undefined,
  supabase: ReturnType<typeof createClient>
): Promise<string | null> {
  // Check if app_user_id is already a Supabase UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(appUserId)) {
    return appUserId;
  }

  // Check subscriber attributes for supabase_user_id
  const supabaseUserId = subscriberAttributes?.['supabase_user_id'] as string | undefined;
  if (supabaseUserId && uuidRegex.test(supabaseUserId)) {
    return supabaseUserId;
  }

  // Try to find user by email if provided
  const email = subscriberAttributes?.['$email'] as string | undefined;
  if (email) {
    const { data: user, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (!error && user) {
      return user.id;
    }
  }

  // Log warning for unmapped user
  log("warn", "Could not map RevenueCat user to Supabase user", {
    appUserId,
    hasEmail: !!email,
    attributes: subscriberAttributes,
  });

  return null;
}

/**
 * Calculate revenue splits
 */
function calculateRevenueSplits(priceCents: number, store: string): {
  platformFeeCents: number;
  mindscriptFeeCents: number;
  netRevenueCents: number;
} {
  // App stores take their cut first
  const platformFeeCents = Math.round(priceCents * PLATFORM_FEE_RATE);
  const afterStoreCut = priceCents - platformFeeCents;

  // MindScript takes its cut from what's left
  const mindscriptFeeCents = Math.round(afterStoreCut * MINDSCRIPT_FEE_RATE);
  const netRevenueCents = afterStoreCut - mindscriptFeeCents;

  return { platformFeeCents, mindscriptFeeCents, netRevenueCents };
}

/**
 * Process INITIAL_PURCHASE event
 */
async function handleInitialPurchase(
  event: z.infer<typeof RevenueCatWebhookEventSchema>['event'],
  supabase: ReturnType<typeof createClient>
) {
  const userId = await mapAppUserToSupabaseUser(
    event.app_user_id,
    event.subscriber_attributes,
    supabase
  );

  if (!userId) {
    throw new Error(`Could not map user for initial purchase: ${event.app_user_id}`);
  }

  const productInfo = PRODUCT_MAPPING[event.product_id];
  if (!productInfo) {
    throw new Error(`Unknown product ID: ${event.product_id}`);
  }

  const priceCents = Math.round((event.price || 0) * 100);
  const { platformFeeCents, mindscriptFeeCents, netRevenueCents } = calculateRevenueSplits(
    priceCents,
    event.store
  );

  // Create purchase record
  const { data: purchase, error: purchaseError } = await supabase
    .from('purchases')
    .insert({
      buyer_id: userId,
      seller_id: userId, // For subscriptions, buyer is also "seller"
      platform: event.store === 'APP_STORE' ? 'ios' : 'android',
      sale_price_cents: priceCents,
      currency: event.currency || 'USD',
      status: 'paid',
      revenuecat_transaction_id: event.store_transaction_id,
      iap_product_id: event.product_id,
      platform_fee_cents: platformFeeCents,
      seller_share_cents: netRevenueCents,
      processor_fee_cents: mindscriptFeeCents,
      is_first_purchase: !event.is_trial_conversion,
    })
    .select()
    .single();

  if (purchaseError) {
    throw new Error(`Failed to create purchase: ${purchaseError.message}`);
  }

  // Create earnings ledger entry
  const { error: ledgerError } = await supabase
    .from('earnings_ledger')
    .insert({
      seller_id: userId,
      purchase_id: purchase.id,
      track_id: null, // Subscriptions don't have specific tracks
      gross_cents: priceCents,
      processor_fee_cents: platformFeeCents,
      platform_fee_cents: mindscriptFeeCents,
      seller_earnings_cents: netRevenueCents,
      currency: event.currency || 'USD',
      channel: event.store === 'APP_STORE' ? 'ios' : 'android',
      payout_status: 'pending',
    });

  if (ledgerError) {
    log("error", "Failed to create earnings ledger entry", { error: ledgerError.message });
  }

  // Grant subscription entitlements
  const expiresAt = event.expiration_at_ms
    ? new Date(event.expiration_at_ms).toISOString()
    : null;

  const { error: entitlementError } = await supabase
    .from('user_subscriptions')
    .upsert({
      user_id: userId,
      tier: productInfo.tier,
      status: 'active',
      current_period_end: expiresAt,
      revenuecat_product_id: event.product_id,
      store_source: event.store.toLowerCase(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    });

  if (entitlementError) {
    log("error", "Failed to grant subscription entitlements", { error: entitlementError.message });
  }

  log("info", "Initial purchase processed", {
    userId,
    productId: event.product_id,
    purchaseId: purchase.id,
    tier: productInfo.tier,
  });
}

/**
 * Process RENEWAL event
 */
async function handleRenewal(
  event: z.infer<typeof RevenueCatWebhookEventSchema>['event'],
  supabase: ReturnType<typeof createClient>
) {
  const userId = await mapAppUserToSupabaseUser(
    event.app_user_id,
    event.subscriber_attributes,
    supabase
  );

  if (!userId) {
    throw new Error(`Could not map user for renewal: ${event.app_user_id}`);
  }

  const productInfo = PRODUCT_MAPPING[event.product_id];
  if (!productInfo) {
    throw new Error(`Unknown product ID: ${event.product_id}`);
  }

  const priceCents = Math.round((event.price || 0) * 100);
  const { platformFeeCents, mindscriptFeeCents, netRevenueCents } = calculateRevenueSplits(
    priceCents,
    event.store
  );

  // Create renewal purchase record
  const { data: purchase, error: purchaseError } = await supabase
    .from('purchases')
    .insert({
      buyer_id: userId,
      seller_id: userId,
      platform: event.store === 'APP_STORE' ? 'ios' : 'android',
      sale_price_cents: priceCents,
      currency: event.currency || 'USD',
      status: 'paid',
      revenuecat_transaction_id: event.store_transaction_id,
      iap_product_id: event.product_id,
      platform_fee_cents: platformFeeCents,
      seller_share_cents: netRevenueCents,
      processor_fee_cents: mindscriptFeeCents,
      is_first_purchase: false,
    })
    .select()
    .single();

  if (purchaseError) {
    throw new Error(`Failed to create renewal purchase: ${purchaseError.message}`);
  }

  // Update subscription status
  const expiresAt = event.expiration_at_ms
    ? new Date(event.expiration_at_ms).toISOString()
    : null;

  const { error: subscriptionError } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'active',
      current_period_end: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (subscriptionError) {
    log("error", "Failed to update subscription", { error: subscriptionError.message });
  }

  log("info", "Renewal processed", {
    userId,
    productId: event.product_id,
    purchaseId: purchase.id,
    expiresAt,
  });
}

/**
 * Process CANCELLATION event
 */
async function handleCancellation(
  event: z.infer<typeof RevenueCatWebhookEventSchema>['event'],
  supabase: ReturnType<typeof createClient>
) {
  const userId = await mapAppUserToSupabaseUser(
    event.app_user_id,
    event.subscriber_attributes,
    supabase
  );

  if (!userId) {
    log("warn", "Could not map user for cancellation", { appUserId: event.app_user_id });
    return;
  }

  // Update subscription to cancelled (but still active until expiration)
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'cancelled',
      cancel_at_period_end: true,
      cancelled_at: new Date().toISOString(),
      cancellation_reason: event.cancellation_reason || 'user_cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    log("error", "Failed to update subscription cancellation", { error: error.message });
  }

  log("info", "Cancellation processed", {
    userId,
    productId: event.product_id,
    reason: event.cancellation_reason,
  });
}

/**
 * Process EXPIRATION event
 */
async function handleExpiration(
  event: z.infer<typeof RevenueCatWebhookEventSchema>['event'],
  supabase: ReturnType<typeof createClient>
) {
  const userId = await mapAppUserToSupabaseUser(
    event.app_user_id,
    event.subscriber_attributes,
    supabase
  );

  if (!userId) {
    log("warn", "Could not map user for expiration", { appUserId: event.app_user_id });
    return;
  }

  // Update subscription to expired
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'expired',
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    log("error", "Failed to expire subscription", { error: error.message });
  }

  log("info", "Expiration processed", {
    userId,
    productId: event.product_id,
  });
}

/**
 * Process BILLING_ISSUE event
 */
async function handleBillingIssue(
  event: z.infer<typeof RevenueCatWebhookEventSchema>['event'],
  supabase: ReturnType<typeof createClient>
) {
  const userId = await mapAppUserToSupabaseUser(
    event.app_user_id,
    event.subscriber_attributes,
    supabase
  );

  if (!userId) {
    log("warn", "Could not map user for billing issue", { appUserId: event.app_user_id });
    return;
  }

  // Update subscription to past_due
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    log("error", "Failed to update billing issue", { error: error.message });
  }

  // TODO: Send email notification about billing issue

  log("info", "Billing issue processed", {
    userId,
    productId: event.product_id,
  });
}

/**
 * Process PRODUCT_CHANGE event
 */
async function handleProductChange(
  event: z.infer<typeof RevenueCatWebhookEventSchema>['event'],
  supabase: ReturnType<typeof createClient>
) {
  const userId = await mapAppUserToSupabaseUser(
    event.app_user_id,
    event.subscriber_attributes,
    supabase
  );

  if (!userId) {
    throw new Error(`Could not map user for product change: ${event.app_user_id}`);
  }

  const newProductInfo = PRODUCT_MAPPING[event.product_id];
  if (!newProductInfo) {
    throw new Error(`Unknown product ID: ${event.product_id}`);
  }

  // Update subscription with new product
  const expiresAt = event.expiration_at_ms
    ? new Date(event.expiration_at_ms).toISOString()
    : null;

  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      tier: newProductInfo.tier,
      revenuecat_product_id: event.product_id,
      current_period_end: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    log("error", "Failed to update product change", { error: error.message });
  }

  log("info", "Product change processed", {
    userId,
    newProductId: event.product_id,
    newTier: newProductInfo.tier,
  });
}

/**
 * Process NON_RENEWING_PURCHASE event (one-time purchases)
 */
async function handleNonRenewingPurchase(
  event: z.infer<typeof RevenueCatWebhookEventSchema>['event'],
  supabase: ReturnType<typeof createClient>
) {
  const userId = await mapAppUserToSupabaseUser(
    event.app_user_id,
    event.subscriber_attributes,
    supabase
  );

  if (!userId) {
    throw new Error(`Could not map user for non-renewing purchase: ${event.app_user_id}`);
  }

  const productInfo = PRODUCT_MAPPING[event.product_id];
  if (!productInfo) {
    throw new Error(`Unknown product ID: ${event.product_id}`);
  }

  const priceCents = Math.round((event.price || 0) * 100);
  const { platformFeeCents, mindscriptFeeCents, netRevenueCents } = calculateRevenueSplits(
    priceCents,
    event.store
  );

  // Create purchase record for one-time purchase
  const { data: purchase, error: purchaseError } = await supabase
    .from('purchases')
    .insert({
      buyer_id: userId,
      seller_id: userId,
      platform: event.store === 'APP_STORE' ? 'ios' : 'android',
      sale_price_cents: priceCents,
      currency: event.currency || 'USD',
      status: 'paid',
      revenuecat_transaction_id: event.store_transaction_id,
      iap_product_id: event.product_id,
      platform_fee_cents: platformFeeCents,
      seller_share_cents: netRevenueCents,
      processor_fee_cents: mindscriptFeeCents,
    })
    .select()
    .single();

  if (purchaseError) {
    throw new Error(`Failed to create one-time purchase: ${purchaseError.message}`);
  }

  // Grant appropriate credits or access based on product
  if (productInfo.tier === 'single' || productInfo.tier.startsWith('bundle')) {
    const credits = productInfo.tier === 'single' ? 1 :
                    productInfo.tier === 'bundle_5' ? 5 : 10;

    const { error: creditError } = await supabase.rpc('add_user_credits', {
      p_user_id: userId,
      p_credits: credits,
      p_source: 'iap_purchase',
      p_reference_id: purchase.id,
    });

    if (creditError) {
      log("error", "Failed to add user credits", { error: creditError.message });
    }
  }

  log("info", "Non-renewing purchase processed", {
    userId,
    productId: event.product_id,
    purchaseId: purchase.id,
  });
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

  // Verify authorization
  const authHeader = req.headers.get("Authorization");
  if (!verifyAuthorization(authHeader)) {
    log("error", "Unauthorized webhook request");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse request body
  let body: unknown;
  try {
    body = await req.json();
  } catch (error) {
    log("error", "Failed to parse request body", { error: String(error) });
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate webhook event schema
  let webhookEvent: z.infer<typeof RevenueCatWebhookEventSchema>;
  try {
    webhookEvent = RevenueCatWebhookEventSchema.parse(body);
  } catch (error) {
    log("error", "Invalid webhook event schema", { error: String(error), body });
    return new Response(JSON.stringify({ error: "Invalid webhook event" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const event = webhookEvent.event;
  log("info", "Received webhook event", {
    eventId: event.id,
    eventType: event.type,
    productId: event.product_id,
    appUserId: event.app_user_id,
    environment: event.environment,
  });

  // Skip sandbox events in production
  if (event.environment === 'SANDBOX' && Deno.env.get("ENVIRONMENT") === 'production') {
    log("info", "Skipping sandbox event in production");
    return new Response(JSON.stringify({ received: true, skipped: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Check for duplicate event (idempotency)
  const { data: existingEvent, error: fetchError } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("provider", "revenuecat")
    .eq("event_id", event.id)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
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
    provider: "revenuecat",
    event_id: event.id,
    event_type: event.type,
    payload: webhookEvent,
    signature: authHeader,
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
      case 'INITIAL_PURCHASE':
        await handleInitialPurchase(event, supabase);
        break;

      case 'RENEWAL':
        await handleRenewal(event, supabase);
        break;

      case 'CANCELLATION':
        await handleCancellation(event, supabase);
        break;

      case 'EXPIRATION':
        await handleExpiration(event, supabase);
        break;

      case 'BILLING_ISSUE':
        await handleBillingIssue(event, supabase);
        break;

      case 'PRODUCT_CHANGE':
        await handleProductChange(event, supabase);
        break;

      case 'NON_RENEWING_PURCHASE':
        await handleNonRenewingPurchase(event, supabase);
        break;

      case 'UNCANCELLATION':
        // Handle reactivation after cancellation
        await handleRenewal(event, supabase); // Treat as renewal
        break;

      case 'SUBSCRIBER_ALIAS':
      case 'TRANSFER':
        // Log but don't process these events yet
        log("info", "Received informational event", { eventType: event.type });
        break;

      default:
        log("warn", "Unhandled webhook event type", { eventType: event.type });
    }

    // Mark event as processed
    await supabase
      .from("webhook_events")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq("provider", "revenuecat")
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
      .eq("provider", "revenuecat")
      .eq("event_id", event.id);

    // Return success to avoid immediate RevenueCat retries
    // We'll handle retries on our end
    return new Response(JSON.stringify({ received: true, error: "Processing failed" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Start the server
serve(handleWebhook);