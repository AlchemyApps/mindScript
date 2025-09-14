import { z } from "zod";
import { UserIdSchema } from "./common";

// Cart item for checkout
export const CartItemSchema = z.object({
  trackId: z.string().uuid(),
  sellerId: UserIdSchema,
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  price: z.number().int().min(0), // in cents
  sellerConnectAccountId: z.string().min(1),
  thumbnailUrl: z.string().url().optional(),
});

// Create checkout session request
export const CreateCheckoutSessionRequestSchema = z.object({
  items: z.array(CartItemSchema).min(1).max(50),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  customerEmail: z.string().email().optional(),
  metadata: z.record(z.string()).optional(),
});

// Checkout session response
export const CheckoutSessionResponseSchema = z.object({
  sessionId: z.string(),
  url: z.string().url(),
  expiresAt: z.string().datetime(),
});

// Purchase record schema
export const PurchaseRecordSchema = z.object({
  id: z.string().uuid(),
  user_id: UserIdSchema.nullable(), // Can be null for guest checkout
  session_id: z.string(), // For guest tracking
  stripe_payment_intent_id: z.string(),
  stripe_checkout_session_id: z.string(),
  amount_total: z.number().int().min(0),
  currency: z.string().length(3).default("USD"),
  status: z.enum(["pending", "processing", "succeeded", "failed", "refunded"]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
  refunded_at: z.string().datetime().nullable(),
  refund_amount: z.number().int().min(0).nullable(),
  metadata: z.record(z.any()).optional(),
});

// Purchase item schema
export const PurchaseItemSchema = z.object({
  id: z.string().uuid(),
  purchase_id: z.string().uuid(),
  track_id: z.string().uuid(),
  seller_id: UserIdSchema,
  price: z.number().int().min(0),
  platform_fee: z.number().int().min(0),
  seller_earnings: z.number().int().min(0),
  stripe_price_id: z.string().optional(),
  stripe_product_id: z.string().optional(),
  created_at: z.string().datetime(),
});

// Track access schema
export const TrackAccessSchema = z.object({
  id: z.string().uuid(),
  user_id: UserIdSchema.nullable(),
  session_id: z.string(), // For guest access
  track_id: z.string().uuid(),
  purchase_id: z.string().uuid(),
  granted_at: z.string().datetime(),
  expires_at: z.string().datetime().nullable(),
  revoked_at: z.string().datetime().nullable(),
  access_type: z.enum(["purchase", "gift", "promotion"]),
});

// Webhook event schema for idempotency
export const WebhookEventSchema = z.object({
  id: z.string(),
  stripe_event_id: z.string(),
  type: z.string(),
  processed_at: z.string().datetime(),
  data: z.record(z.any()),
  status: z.enum(["pending", "processing", "processed", "failed"]),
  error: z.string().nullable(),
  retry_count: z.number().int().min(0).default(0),
});

// Platform fee calculation
export const calculatePlatformFee = (amount: number, feePercent: number = 15): number => {
  return Math.floor(amount * (feePercent / 100));
};

// Calculate seller earnings
export const calculateSellerEarnings = (amount: number, platformFee: number): number => {
  return amount - platformFee;
};

// Types
export type CartItem = z.infer<typeof CartItemSchema>;
export type CreateCheckoutSessionRequest = z.infer<typeof CreateCheckoutSessionRequestSchema>;
export type CheckoutSessionResponse = z.infer<typeof CheckoutSessionResponseSchema>;
export type PurchaseRecord = z.infer<typeof PurchaseRecordSchema>;
export type PurchaseItem = z.infer<typeof PurchaseItemSchema>;
export type TrackAccess = z.infer<typeof TrackAccessSchema>;
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;