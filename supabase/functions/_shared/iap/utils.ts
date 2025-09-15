/**
 * Shared IAP Utilities for Supabase Edge Functions
 *
 * Common functions for processing In-App Purchases across
 * RevenueCat webhooks and client verification endpoints
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ==================== Types ====================

export interface IAPProduct {
  id: string;
  tier: 'starter' | 'creator' | 'studio' | 'single' | 'bundle_5' | 'bundle_10';
  billing: 'monthly' | 'yearly' | 'once';
  isIntro: boolean;
  priceCents: number;
  credits?: number; // For bundle purchases
}

export interface RevenueSplit {
  grossCents: number;
  platformFeeCents: number;
  mindscriptFeeCents: number;
  netRevenueCents: number;
}

export interface UserMapping {
  userId: string | null;
  source: 'direct' | 'attribute' | 'email' | 'not_found';
}

// ==================== Constants ====================

export const IAP_PRODUCTS: Record<string, IAPProduct> = {
  // Introductory offer
  'mindscript_intro_monthly': {
    id: 'mindscript_intro_monthly',
    tier: 'starter',
    billing: 'monthly',
    isIntro: true,
    priceCents: 99, // $0.99
  },

  // Starter tier
  'mindscript_starter_monthly': {
    id: 'mindscript_starter_monthly',
    tier: 'starter',
    billing: 'monthly',
    isIntro: false,
    priceCents: 999, // $9.99
  },
  'mindscript_starter_yearly': {
    id: 'mindscript_starter_yearly',
    tier: 'starter',
    billing: 'yearly',
    isIntro: false,
    priceCents: 9999, // $99.99
  },

  // Creator tier
  'mindscript_creator_monthly': {
    id: 'mindscript_creator_monthly',
    tier: 'creator',
    billing: 'monthly',
    isIntro: false,
    priceCents: 1999, // $19.99
  },
  'mindscript_creator_yearly': {
    id: 'mindscript_creator_yearly',
    tier: 'creator',
    billing: 'yearly',
    isIntro: false,
    priceCents: 19999, // $199.99
  },

  // Studio tier
  'mindscript_studio_monthly': {
    id: 'mindscript_studio_monthly',
    tier: 'studio',
    billing: 'monthly',
    isIntro: false,
    priceCents: 3999, // $39.99
  },
  'mindscript_studio_yearly': {
    id: 'mindscript_studio_yearly',
    tier: 'studio',
    billing: 'yearly',
    isIntro: false,
    priceCents: 39999, // $399.99
  },

  // One-time purchases
  'mindscript_track_single': {
    id: 'mindscript_track_single',
    tier: 'single',
    billing: 'once',
    isIntro: false,
    priceCents: 499, // $4.99
    credits: 1,
  },
  'mindscript_track_bundle_5': {
    id: 'mindscript_track_bundle_5',
    tier: 'bundle_5',
    billing: 'once',
    isIntro: false,
    priceCents: 1999, // $19.99
    credits: 5,
  },
  'mindscript_track_bundle_10': {
    id: 'mindscript_track_bundle_10',
    tier: 'bundle_10',
    billing: 'once',
    isIntro: false,
    priceCents: 3499, // $34.99
    credits: 10,
  },
};

// Platform fee rates
export const PLATFORM_FEES = {
  APP_STORE_STANDARD: 0.30,
  APP_STORE_SMALL_BUSINESS: 0.15,
  PLAY_STORE_STANDARD: 0.30,
  PLAY_STORE_SMALL_BUSINESS: 0.15,
  MINDSCRIPT_RATE: 0.15, // Our platform fee after store cut
};

// ==================== User Mapping ====================

/**
 * Map RevenueCat app_user_id to Supabase user_id
 * Tries multiple strategies in order:
 * 1. Direct UUID match
 * 2. Subscriber attributes
 * 3. Email lookup
 */
export async function mapAppUserToSupabaseUser(
  appUserId: string,
  subscriberAttributes: Record<string, unknown> | undefined,
  supabase: SupabaseClient
): Promise<UserMapping> {
  // Strategy 1: Check if app_user_id is already a Supabase UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(appUserId)) {
    // Verify user exists
    const { data: user, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', appUserId)
      .single();

    if (!error && user) {
      return { userId: appUserId, source: 'direct' };
    }
  }

  // Strategy 2: Check subscriber attributes for supabase_user_id
  const supabaseUserId = subscriberAttributes?.['supabase_user_id'] as string | undefined;
  if (supabaseUserId && uuidRegex.test(supabaseUserId)) {
    const { data: user, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', supabaseUserId)
      .single();

    if (!error && user) {
      return { userId: supabaseUserId, source: 'attribute' };
    }
  }

  // Strategy 3: Try to find user by email
  const email = subscriberAttributes?.['$email'] as string | undefined;
  if (email) {
    const { data: user, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (!error && user) {
      return { userId: user.id, source: 'email' };
    }
  }

  // User not found
  return { userId: null, source: 'not_found' };
}

// ==================== Revenue Calculations ====================

/**
 * Calculate revenue splits for IAP
 * Accounts for platform fees (Apple/Google) and MindScript fees
 */
export function calculateRevenueSplits(
  priceCents: number,
  store: 'APP_STORE' | 'PLAY_STORE',
  isSmallBusiness: boolean = false
): RevenueSplit {
  // Determine platform fee rate
  let platformFeeRate: number;
  if (store === 'APP_STORE') {
    platformFeeRate = isSmallBusiness
      ? PLATFORM_FEES.APP_STORE_SMALL_BUSINESS
      : PLATFORM_FEES.APP_STORE_STANDARD;
  } else {
    platformFeeRate = isSmallBusiness
      ? PLATFORM_FEES.PLAY_STORE_SMALL_BUSINESS
      : PLATFORM_FEES.PLAY_STORE_STANDARD;
  }

  // Calculate fees
  const platformFeeCents = Math.round(priceCents * platformFeeRate);
  const afterStoreCut = priceCents - platformFeeCents;
  const mindscriptFeeCents = Math.round(afterStoreCut * PLATFORM_FEES.MINDSCRIPT_RATE);
  const netRevenueCents = afterStoreCut - mindscriptFeeCents;

  return {
    grossCents: priceCents,
    platformFeeCents,
    mindscriptFeeCents,
    netRevenueCents,
  };
}

// ==================== Purchase Processing ====================

/**
 * Create a purchase record with proper deduplication
 */
export async function createPurchaseRecord(
  supabase: SupabaseClient,
  params: {
    userId: string;
    productId: string;
    transactionId: string;
    platform: 'ios' | 'android';
    priceCents: number;
    currency: string;
    revenueSplit: RevenueSplit;
    isTrialConversion?: boolean;
    metadata?: Record<string, unknown>;
  }
): Promise<{ purchaseId: string | null; isDuplicate: boolean; error?: string }> {
  // Check for existing purchase with same transaction ID
  const { data: existing, error: checkError } = await supabase
    .from('purchases')
    .select('id')
    .eq('revenuecat_transaction_id', params.transactionId)
    .single();

  if (checkError && checkError.code !== 'PGRST116') {
    return { purchaseId: null, isDuplicate: false, error: checkError.message };
  }

  if (existing) {
    return { purchaseId: existing.id, isDuplicate: true };
  }

  // Create new purchase
  const { data: purchase, error: insertError } = await supabase
    .from('purchases')
    .insert({
      buyer_id: params.userId,
      seller_id: params.userId, // For subscriptions, buyer is also "seller"
      platform: params.platform,
      sale_price_cents: params.priceCents,
      currency: params.currency,
      status: 'paid',
      revenuecat_transaction_id: params.transactionId,
      iap_product_id: params.productId,
      platform_fee_cents: params.revenueSplit.platformFeeCents,
      seller_share_cents: params.revenueSplit.netRevenueCents,
      processor_fee_cents: params.revenueSplit.mindscriptFeeCents,
      is_first_purchase: !params.isTrialConversion,
      metadata: params.metadata,
    })
    .select()
    .single();

  if (insertError) {
    return { purchaseId: null, isDuplicate: false, error: insertError.message };
  }

  return { purchaseId: purchase.id, isDuplicate: false };
}

/**
 * Update subscription status
 */
export async function updateSubscriptionStatus(
  supabase: SupabaseClient,
  userId: string,
  params: {
    tier: string;
    status: 'active' | 'cancelled' | 'expired' | 'past_due';
    productId: string;
    expiresAt?: string;
    cancelledAt?: string;
    cancellationReason?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const updateData: Record<string, unknown> = {
    tier: params.tier,
    status: params.status,
    revenuecat_product_id: params.productId,
    updated_at: new Date().toISOString(),
  };

  if (params.expiresAt) {
    updateData.current_period_end = params.expiresAt;
  }

  if (params.cancelledAt) {
    updateData.cancelled_at = params.cancelledAt;
    updateData.cancel_at_period_end = true;
  }

  if (params.cancellationReason) {
    updateData.cancellation_reason = params.cancellationReason;
  }

  const { error } = await supabase
    .from('user_subscriptions')
    .upsert(updateData, {
      onConflict: 'user_id',
    })
    .eq('user_id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Grant user credits for bundle purchases
 */
export async function grantUserCredits(
  supabase: SupabaseClient,
  userId: string,
  credits: number,
  purchaseId: string
): Promise<{ success: boolean; error?: string }> {
  // Use RPC function to atomically add credits
  const { error } = await supabase.rpc('add_user_credits', {
    p_user_id: userId,
    p_credits: credits,
    p_source: 'iap_purchase',
    p_reference_id: purchaseId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ==================== Ledger Management ====================

/**
 * Create earnings ledger entry for tracking revenue
 */
export async function createEarningsLedgerEntry(
  supabase: SupabaseClient,
  params: {
    sellerId: string;
    purchaseId: string;
    trackId?: string;
    revenueSplit: RevenueSplit;
    currency: string;
    channel: 'ios' | 'android';
  }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('earnings_ledger')
    .insert({
      seller_id: params.sellerId,
      purchase_id: params.purchaseId,
      track_id: params.trackId || null,
      gross_cents: params.revenueSplit.grossCents,
      processor_fee_cents: params.revenueSplit.platformFeeCents,
      platform_fee_cents: params.revenueSplit.mindscriptFeeCents,
      seller_earnings_cents: params.revenueSplit.netRevenueCents,
      currency: params.currency,
      channel: params.channel,
      payout_status: 'pending',
    });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ==================== Validation ====================

/**
 * Validate RevenueCat product ID
 */
export function validateProductId(productId: string): {
  valid: boolean;
  product?: IAPProduct;
  error?: string;
} {
  const product = IAP_PRODUCTS[productId];

  if (!product) {
    return {
      valid: false,
      error: `Unknown product ID: ${productId}`,
    };
  }

  return {
    valid: true,
    product,
  };
}

/**
 * Check if a transaction is a duplicate
 */
export async function isDuplicateTransaction(
  supabase: SupabaseClient,
  transactionId: string,
  provider: 'revenuecat' | 'app_store' | 'play_store'
): Promise<boolean> {
  const { data, error } = await supabase
    .from('purchases')
    .select('id')
    .or(`revenuecat_transaction_id.eq.${transactionId},store_transaction_id.eq.${transactionId}`)
    .single();

  // PGRST116 means no rows found
  if (error && error.code === 'PGRST116') {
    return false;
  }

  return !!data;
}

// ==================== Logging ====================

/**
 * Structured logging helper
 */
export function log(
  level: 'info' | 'warn' | 'error',
  message: string,
  context?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    service: 'iap-utils',
    message,
    ...context,
  };
  console.log(JSON.stringify(logEntry));
}

// ==================== Error Handling ====================

/**
 * Format error response for webhook handlers
 */
export function formatErrorResponse(
  error: unknown,
  context?: Record<string, unknown>
): Response {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  log('error', 'IAP processing error', {
    error: errorMessage,
    ...context,
  });

  // Return 200 to prevent immediate retries from webhook providers
  // We handle retries internally
  return new Response(
    JSON.stringify({
      received: true,
      error: 'Processing failed',
      message: errorMessage,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Format success response for webhook handlers
 */
export function formatSuccessResponse(
  data?: Record<string, unknown>
): Response {
  return new Response(
    JSON.stringify({
      received: true,
      ...data,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}