import { z } from "zod";
import { UserIdSchema, TimestampsSchema } from "./common";

// Seller agreement status
export const SellerStatusSchema = z.enum([
  "pending_onboarding",
  "onboarding_incomplete",
  "active",
  "suspended",
  "rejected",
]);

// Connect account type
export const ConnectAccountTypeSchema = z.enum(["express", "standard", "custom"]);

// Seller agreement schema
export const SellerAgreementSchema = z.object({
  id: z.string().uuid(),
  userId: UserIdSchema,
  stripeConnectAccountId: z.string().optional(),
  accountType: ConnectAccountTypeSchema.default("express"),
  status: SellerStatusSchema.default("pending_onboarding"),
  
  // Onboarding details
  onboardingCompletedAt: z.string().datetime().optional(),
  detailsSubmitted: z.boolean().default(false),
  chargesEnabled: z.boolean().default(false),
  payoutsEnabled: z.boolean().default(false),
  
  // Platform configuration
  platformFeePercent: z.number().min(0).max(100).default(15),
  customPricingEnabled: z.boolean().default(false),
  
  // Compliance
  tosAcceptedAt: z.string().datetime().optional(),
  tosAcceptedIp: z.string().optional(),
  kycVerifiedAt: z.string().datetime().optional(),
  
  // Metadata
  defaultCurrency: z.string().length(3).default("USD"),
  country: z.string().length(2).optional(),
  businessName: z.string().optional(),
  businessType: z.enum(["individual", "company"]).optional(),
}).merge(TimestampsSchema);

// Create seller agreement
export const CreateSellerAgreementSchema = z.object({
  userId: UserIdSchema,
  accountType: ConnectAccountTypeSchema.default("express"),
  platformFeePercent: z.number().min(0).max(100).default(15),
  tosAcceptedIp: z.string(),
});

// Update seller agreement
export const UpdateSellerAgreementSchema = z.object({
  stripeConnectAccountId: z.string().optional(),
  status: SellerStatusSchema.optional(),
  detailsSubmitted: z.boolean().optional(),
  chargesEnabled: z.boolean().optional(),
  payoutsEnabled: z.boolean().optional(),
  onboardingCompletedAt: z.string().datetime().optional(),
  kycVerifiedAt: z.string().datetime().optional(),
  businessName: z.string().optional(),
  businessType: z.enum(["individual", "company"]).optional(),
  country: z.string().length(2).optional(),
});

// Earnings summary schema
export const EarningsSummarySchema = z.object({
  totalEarningsCents: z.number().int().min(0),
  pendingPayoutCents: z.number().int().min(0),
  completedPayoutsCents: z.number().int().min(0),
  availableBalanceCents: z.number().int().min(0),
  platformFeesCents: z.number().int().min(0),
  processingFeesCents: z.number().int().min(0),
  currency: z.string().length(3).default("USD"),
  lastPayoutDate: z.string().datetime().optional(),
  nextPayoutDate: z.string().datetime().optional(),
});

// Earnings period schema
export const EarningsPeriodSchema = z.object({
  period: z.enum(["daily", "weekly", "monthly", "yearly"]),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  data: z.array(z.object({
    date: z.string().datetime(),
    earningsCents: z.number().int().min(0),
    salesCount: z.number().int().min(0),
    platformFeesCents: z.number().int().min(0),
  })),
});

// Track listing schema for seller dashboard
export const SellerTrackListingSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  status: z.enum(["draft", "published", "archived"]),
  visibility: z.enum(["public", "private", "unlisted"]),
  priceCents: z.number().int().min(0).optional(),
  salesCount: z.number().int().min(0).default(0),
  totalEarningsCents: z.number().int().min(0).default(0),
  createdAt: z.string().datetime(),
  lastSaleAt: z.string().datetime().optional(),
  thumbnailUrl: z.string().url().optional(),
});

// Bulk update pricing schema
export const BulkUpdatePricingSchema = z.object({
  trackIds: z.array(z.string().uuid()).min(1),
  action: z.enum(["set_price", "increase_percent", "decrease_percent", "enable", "disable"]),
  priceCents: z.number().int().min(0).optional(),
  percentChange: z.number().min(0).max(100).optional(),
});

// Payout request schema
export const PayoutRequestSchema = z.object({
  amountCents: z.number().int().min(1000), // Minimum $10
  currency: z.string().length(3).default("USD"),
  reason: z.enum(["manual", "scheduled", "emergency"]).default("manual"),
  notes: z.string().optional(),
});

// Connect onboarding response
export const ConnectOnboardingResponseSchema = z.object({
  accountId: z.string(),
  onboardingUrl: z.string().url(),
  returnUrl: z.string().url(),
  refreshUrl: z.string().url(),
});

// Connect account status
export const ConnectAccountStatusSchema = z.object({
  accountId: z.string(),
  detailsSubmitted: z.boolean(),
  chargesEnabled: z.boolean(),
  payoutsEnabled: z.boolean(),
  requirementsCurrentlyDue: z.array(z.string()),
  requirementsPastDue: z.array(z.string()),
  requirementsEventuallyDue: z.array(z.string()),
  requirementsDisabledReason: z.string().optional(),
});

// Export earnings CSV schema
export const ExportEarningsSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  format: z.enum(["csv", "json"]).default("csv"),
  includeDetails: z.boolean().default(true),
});

// Types
export type SellerAgreement = z.infer<typeof SellerAgreementSchema>;
export type CreateSellerAgreement = z.infer<typeof CreateSellerAgreementSchema>;
export type UpdateSellerAgreement = z.infer<typeof UpdateSellerAgreementSchema>;
export type EarningsSummary = z.infer<typeof EarningsSummarySchema>;
export type EarningsPeriod = z.infer<typeof EarningsPeriodSchema>;
export type SellerTrackListing = z.infer<typeof SellerTrackListingSchema>;
export type BulkUpdatePricing = z.infer<typeof BulkUpdatePricingSchema>;
export type PayoutRequest = z.infer<typeof PayoutRequestSchema>;
export type ConnectOnboardingResponse = z.infer<typeof ConnectOnboardingResponseSchema>;
export type ConnectAccountStatus = z.infer<typeof ConnectAccountStatusSchema>;
export type ExportEarnings = z.infer<typeof ExportEarningsSchema>;
export type SellerStatus = z.infer<typeof SellerStatusSchema>;
export type ConnectAccountType = z.infer<typeof ConnectAccountTypeSchema>;