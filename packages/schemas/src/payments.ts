import { z } from "zod";
import {
  UserIdSchema,
  RenderIdSchema,
  PublicationIdSchema,
  PurchaseIdSchema,
  PlatformSchema,
  TimestampsSchema,
} from "./common";

// Payment status
export const PaymentStatusSchema = z.enum([
  "pending",
  "processing",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
  "cancelled",
]);

// Purchase schema
export const PurchaseSchema = z.object({
  id: PurchaseIdSchema,
  buyerId: UserIdSchema,
  renderId: RenderIdSchema,
  publicationId: PublicationIdSchema.optional(),
  platform: PlatformSchema,
  
  // Payment details
  salePriceCents: z.number().int().min(0),
  currency: z.string().length(3).default("USD"), // ISO 4217
  status: PaymentStatusSchema,
  
  // Platform-specific
  stripePaymentIntentId: z.string().optional(),
  stripeCheckoutSessionId: z.string().optional(),
  iapProductId: z.string().optional(),
  iapReceiptData: z.string().optional(),
  revenuecatTransactionId: z.string().optional(),
  
  // Line items breakdown
  lineItemsJson: z.object({
    base: z.number().int().min(0),
    background: z.number().int().min(0).optional(),
    solfeggio: z.number().int().min(0).optional(),
    binaural: z.number().int().min(0).optional(),
    voiceSetup: z.number().int().min(0).optional(),
  }),
  
  // Revenue split
  sellerShareCents: z.number().int().min(0).optional(),
  platformFeeCents: z.number().int().min(0).optional(),
  processorFeeCents: z.number().int().min(0).optional(),
  
  // Metadata
  isFirstPurchase: z.boolean().default(false),
  refundedAt: z.string().datetime().optional(),
  refundAmount: z.number().int().min(0).optional(),
}).merge(TimestampsSchema);

// Create purchase (internal)
export const CreatePurchaseSchema = z.object({
  buyerId: UserIdSchema,
  renderId: RenderIdSchema,
  publicationId: PublicationIdSchema.optional(),
  platform: PlatformSchema,
  salePriceCents: z.number().int().min(0),
  currency: z.string().length(3).default("USD"),
  lineItemsJson: z.object({
    base: z.number().int().min(0),
    background: z.number().int().min(0).optional(),
    solfeggio: z.number().int().min(0).optional(),
    binaural: z.number().int().min(0).optional(),
    voiceSetup: z.number().int().min(0).optional(),
  }),
  isFirstPurchase: z.boolean().default(false),
});

// Stripe checkout session creation
export const CreateCheckoutSessionSchema = z.object({
  renderId: RenderIdSchema.optional(),
  publicationId: PublicationIdSchema.optional(),
  lineItems: z.object({
    base: z.number().int().min(0),
    backgroundTrackId: z.string().optional(),
    includeSolfeggio: z.boolean().default(false),
    includeBinaural: z.boolean().default(false),
    includeVoiceSetup: z.boolean().default(false),
  }),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
  customerEmail: z.string().email().optional(),
});

// IAP validation schemas
export const ValidateIAPPurchaseSchema = z.object({
  platform: z.enum(["ios", "android"]),
  productId: z.string(),
  purchaseToken: z.string(),
  renderId: RenderIdSchema.optional(),
  publicationId: PublicationIdSchema.optional(),
});

// Earnings/ledger schemas
export const EarningsLedgerSchema = z.object({
  id: z.string().uuid(),
  publicationId: PublicationIdSchema,
  purchaseId: PurchaseIdSchema,
  sellerId: UserIdSchema,
  channel: PlatformSchema,
  
  // Financial breakdown
  grossCents: z.number().int().min(0),
  processorFeeCents: z.number().int().min(0),
  platformCutCents: z.number().int().min(0),
  sellerCutCents: z.number().int().min(0),
  
  // Payout tracking
  payoutId: z.string().optional(),
  payoutStatus: z.enum(["pending", "processing", "paid", "failed"]).default("pending"),
  payoutDate: z.string().datetime().optional(),
}).merge(TimestampsSchema);

// Seller payout schema
export const PayoutSchema = z.object({
  id: z.string().uuid(),
  sellerId: UserIdSchema,
  stripeTransferId: z.string().optional(),
  amountCents: z.number().int().min(0),
  currency: z.string().length(3).default("USD"),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  failureReason: z.string().optional(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  transactionCount: z.number().int().min(0),
}).merge(TimestampsSchema);

// Webhook schemas
export const StripeWebhookSchema = z.object({
  id: z.string(),
  object: z.string(),
  type: z.string(),
  data: z.record(z.unknown()),
  livemode: z.boolean(),
  created: z.number(),
});

export const RevenueCatWebhookSchema = z.object({
  event: z.object({
    type: z.string(),
    id: z.string(),
    app_user_id: z.string(),
    product_id: z.string(),
    purchased_at_ms: z.number(),
    expiration_at_ms: z.number().optional(),
    environment: z.enum(["SANDBOX", "PRODUCTION"]),
  }),
});

// Admin pricing schemas
export const PricingConfigSchema = z.object({
  webIntroPrice: z.number().int().min(0).default(100), // $1.00
  webBasePrice: z.number().int().min(0).default(300), // $3.00
  solfeggioAddOn: z.number().int().min(0).default(50), // $0.50
  binauralAddOn: z.number().int().min(0).default(50), // $0.50
  voiceSetupFee: z.number().int().min(0).default(500), // $5.00
  sellerSharePercent: z.number().min(0).max(100).default(70),
  minPayoutAmount: z.number().int().min(0).default(1000), // $10.00
});