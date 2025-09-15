/**
 * In-App Purchase (IAP) Schemas for RevenueCat Integration
 */
import { z } from 'zod';

// ==================== Constants ====================

/**
 * RevenueCat Product ID Mapping
 * Maps RevenueCat product IDs to internal features and tiers
 */
export const REVENUECAT_PRODUCTS = {
  // Introductory offer (first month at $0.99)
  INTRO_MONTHLY: 'mindscript_intro_monthly',

  // Standard subscription tiers
  STARTER_MONTHLY: 'mindscript_starter_monthly',
  STARTER_YEARLY: 'mindscript_starter_yearly',

  CREATOR_MONTHLY: 'mindscript_creator_monthly',
  CREATOR_YEARLY: 'mindscript_creator_yearly',

  STUDIO_MONTHLY: 'mindscript_studio_monthly',
  STUDIO_YEARLY: 'mindscript_studio_yearly',

  // One-time purchases
  TRACK_SINGLE: 'mindscript_track_single',
  TRACK_BUNDLE_5: 'mindscript_track_bundle_5',
  TRACK_BUNDLE_10: 'mindscript_track_bundle_10',
} as const;

/**
 * Platform fee percentages for IAP
 * Apple and Google typically take 30% for standard purchases, 15% for small business
 */
export const IAP_PLATFORM_FEES = {
  APPLE_STANDARD: 0.30,
  APPLE_SMALL_BUSINESS: 0.15, // After $1M revenue
  GOOGLE_STANDARD: 0.30,
  GOOGLE_SMALL_BUSINESS: 0.15, // After $1M revenue
} as const;

// ==================== Enums ====================

export const RevenueCatEventTypeEnum = z.enum([
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
]);

export const RevenueCatStoreEnum = z.enum([
  'APP_STORE',
  'PLAY_STORE',
  'STRIPE',
  'PROMOTIONAL',
  'AMAZON',
]);

export const RevenueCatEnvironmentEnum = z.enum([
  'PRODUCTION',
  'SANDBOX',
]);

export const RevenueCatCancellationReasonEnum = z.enum([
  'UNSUBSCRIBE',
  'BILLING_ERROR',
  'DEVELOPER_INITIATED',
  'PRICE_INCREASE',
  'CUSTOMER_SUPPORT',
  'UNKNOWN',
]);

// ==================== Core Schemas ====================

/**
 * RevenueCat subscriber attributes
 */
export const RevenueCatSubscriberAttributesSchema = z.object({
  '$email': z.string().email().optional(),
  '$displayName': z.string().optional(),
  'supabase_user_id': z.string().uuid().optional(), // Custom attribute for linking
}).passthrough(); // Allow additional custom attributes

/**
 * RevenueCat transaction data
 */
export const RevenueCatTransactionSchema = z.object({
  id: z.string(),
  store_transaction_id: z.string(),
  original_transaction_id: z.string(),
  is_sandbox: z.boolean(),
  purchased_at_ms: z.number(),
  original_purchased_at_ms: z.number().optional(),
});

/**
 * RevenueCat product data
 */
export const RevenueCatProductSchema = z.object({
  id: z.string(),
  store_product_id: z.string(),
  period_type: z.enum(['TRIAL', 'INTRO', 'NORMAL']).optional(),
  duration: z.string().optional(), // e.g., "P1M", "P1Y"
});

/**
 * RevenueCat webhook event payload
 */
export const RevenueCatWebhookEventSchema = z.object({
  api_version: z.string(),
  event: z.object({
    id: z.string().uuid(),
    type: RevenueCatEventTypeEnum,
    event_timestamp_ms: z.number(),
    app_id: z.string(),
    app_user_id: z.string(),
    original_app_user_id: z.string(),
    aliases: z.array(z.string()).optional(),

    // Product and transaction info
    product: RevenueCatProductSchema.optional(),
    product_id: z.string(),
    entitlement_id: z.string().optional(),
    entitlement_ids: z.array(z.string()).optional(),

    // Timing
    purchased_at_ms: z.number().optional(),
    expiration_at_ms: z.number().optional(),
    grace_period_expiration_at_ms: z.number().optional(),
    billing_issue_detected_at_ms: z.number().optional(),

    // Pricing
    price: z.number().optional(),
    currency: z.string().optional(),
    price_in_purchased_currency: z.number().optional(),

    // Transaction details
    store: RevenueCatStoreEnum,
    environment: RevenueCatEnvironmentEnum,
    store_transaction_id: z.string().optional(),
    original_store_transaction_id: z.string().optional(),
    is_family_share: z.boolean().optional(),

    // Subscription state changes
    new_product_id: z.string().optional(), // For PRODUCT_CHANGE events
    cancellation_reason: RevenueCatCancellationReasonEnum.optional(),

    // Transfer info
    transferred_from: z.array(z.string()).optional(),
    transferred_to: z.array(z.string()).optional(),

    // Subscriber attributes
    subscriber_attributes: RevenueCatSubscriberAttributesSchema.optional(),

    // Renewal info
    is_trial_conversion: z.boolean().optional(),
    auto_resume_at_ms: z.number().optional(),
  }),
});

// ==================== Request/Response Schemas ====================

/**
 * Request to grant IAP entitlements (from mobile app to server)
 */
export const IAPGrantRequestSchema = z.object({
  user_id: z.string().uuid(),
  product_id: z.string(),
  store_transaction_id: z.string(),
  store: z.enum(['app_store', 'play_store']),
  purchased_at: z.string().datetime(),
  receipt_data: z.string().optional(), // Base64 encoded receipt for additional verification
});

/**
 * Response from IAP grant endpoint
 */
export const IAPGrantResponseSchema = z.object({
  success: z.boolean(),
  purchase_id: z.string().uuid().optional(),
  entitlements: z.array(z.string()).optional(),
  error: z.string().optional(),
});

/**
 * IAP verification request (server-side)
 */
export const IAPVerificationRequestSchema = z.object({
  receipt_data: z.string(), // Base64 encoded
  store: z.enum(['app_store', 'play_store']),
  is_sandbox: z.boolean().default(false),
});

/**
 * IAP verification response
 */
export const IAPVerificationResponseSchema = z.object({
  valid: z.boolean(),
  product_id: z.string().optional(),
  transaction_id: z.string().optional(),
  expires_at: z.string().datetime().optional(),
  error: z.string().optional(),
});

// ==================== Database Schemas ====================

/**
 * IAP purchase record for database
 */
export const IAPPurchaseRecordSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  platform: z.enum(['ios', 'android']),
  product_id: z.string(),
  revenuecat_product_id: z.string(),
  store_transaction_id: z.string(),
  original_transaction_id: z.string(),

  // Financial
  price_cents: z.number().int().min(0),
  currency: z.string().length(3),
  platform_fee_cents: z.number().int().min(0),
  net_revenue_cents: z.number().int().min(0),

  // Status
  status: z.enum(['pending', 'completed', 'failed', 'refunded']),
  is_sandbox: z.boolean(),
  is_trial_conversion: z.boolean().default(false),
  is_intro_offer: z.boolean().default(false),

  // Subscription info
  expires_at: z.string().datetime().optional(),
  cancelled_at: z.string().datetime().optional(),
  cancellation_reason: RevenueCatCancellationReasonEnum.optional(),

  // Timestamps
  purchased_at: z.string().datetime(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

/**
 * Webhook event record with idempotency tracking
 */
export const WebhookEventRecordSchema = z.object({
  id: z.string().uuid(),
  provider: z.enum(['revenuecat', 'stripe']),
  event_id: z.string(),
  event_type: z.string(),
  payload: z.record(z.unknown()),
  signature: z.string().optional(),
  processed: z.boolean().default(false),
  processed_at: z.string().datetime().optional(),
  error_message: z.string().optional(),
  retry_count: z.number().int().default(0),
  created_at: z.string().datetime(),
});

// ==================== Helper Functions ====================

/**
 * Map RevenueCat product ID to internal tier/feature
 */
export function mapRevenueCatProductToTier(productId: string): {
  tier: 'starter' | 'creator' | 'studio' | 'single' | 'bundle';
  billing: 'monthly' | 'yearly' | 'once';
  isIntro: boolean;
} {
  switch (productId) {
    case REVENUECAT_PRODUCTS.INTRO_MONTHLY:
      return { tier: 'starter', billing: 'monthly', isIntro: true };

    case REVENUECAT_PRODUCTS.STARTER_MONTHLY:
      return { tier: 'starter', billing: 'monthly', isIntro: false };
    case REVENUECAT_PRODUCTS.STARTER_YEARLY:
      return { tier: 'starter', billing: 'yearly', isIntro: false };

    case REVENUECAT_PRODUCTS.CREATOR_MONTHLY:
      return { tier: 'creator', billing: 'monthly', isIntro: false };
    case REVENUECAT_PRODUCTS.CREATOR_YEARLY:
      return { tier: 'creator', billing: 'yearly', isIntro: false };

    case REVENUECAT_PRODUCTS.STUDIO_MONTHLY:
      return { tier: 'studio', billing: 'monthly', isIntro: false };
    case REVENUECAT_PRODUCTS.STUDIO_YEARLY:
      return { tier: 'studio', billing: 'yearly', isIntro: false };

    case REVENUECAT_PRODUCTS.TRACK_SINGLE:
      return { tier: 'single', billing: 'once', isIntro: false };
    case REVENUECAT_PRODUCTS.TRACK_BUNDLE_5:
    case REVENUECAT_PRODUCTS.TRACK_BUNDLE_10:
      return { tier: 'bundle', billing: 'once', isIntro: false };

    default:
      throw new Error(`Unknown RevenueCat product ID: ${productId}`);
  }
}

/**
 * Calculate net revenue after platform fees
 */
export function calculateIAPNetRevenue(
  grossCents: number,
  store: 'app_store' | 'play_store',
  isSmallBusiness = false
): {
  platformFeeCents: number;
  netRevenueCents: number;
} {
  const feeRate = isSmallBusiness
    ? (store === 'app_store' ? IAP_PLATFORM_FEES.APPLE_SMALL_BUSINESS : IAP_PLATFORM_FEES.GOOGLE_SMALL_BUSINESS)
    : (store === 'app_store' ? IAP_PLATFORM_FEES.APPLE_STANDARD : IAP_PLATFORM_FEES.GOOGLE_STANDARD);

  const platformFeeCents = Math.round(grossCents * feeRate);
  const netRevenueCents = grossCents - platformFeeCents;

  return { platformFeeCents, netRevenueCents };
}

// ==================== Type Exports ====================

export type RevenueCatEventType = z.infer<typeof RevenueCatEventTypeEnum>;
export type RevenueCatStore = z.infer<typeof RevenueCatStoreEnum>;
export type RevenueCatEnvironment = z.infer<typeof RevenueCatEnvironmentEnum>;
export type RevenueCatCancellationReason = z.infer<typeof RevenueCatCancellationReasonEnum>;
export type RevenueCatWebhookEvent = z.infer<typeof RevenueCatWebhookEventSchema>;
export type IAPGrantRequest = z.infer<typeof IAPGrantRequestSchema>;
export type IAPGrantResponse = z.infer<typeof IAPGrantResponseSchema>;
export type IAPPurchaseRecord = z.infer<typeof IAPPurchaseRecordSchema>;
export type WebhookEventRecord = z.infer<typeof WebhookEventRecordSchema>;