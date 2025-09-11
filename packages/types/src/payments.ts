import { 
  UserId, 
  RenderId, 
  PurchaseId,
  PublicationId,
  Platform,
  Timestamps 
} from "./common";

export type LineItem = {
  type: "base" | "background" | "solfeggio" | "binaural" | "elevenlabs_setup";
  name: string;
  priceCents: number;
  quantity: number;
};

export type Purchase = {
  id: PurchaseId;
  buyerId: UserId;
  renderId: RenderId;
  platform: Platform;
  iapProductId?: string; // For mobile IAP
  salePriceCents: number;
  currency: string;
  externalRef: string; // Stripe session ID or IAP transaction ID
  status: "pending" | "paid" | "fulfilled" | "cancelled" | "refunded";
  lineItemsJson: LineItem[]; // JSONB field with itemized pricing
  sellerShareCents?: number;
  platformFeeCents?: number;
} & Timestamps;

export type EarningsLedger = {
  id: string;
  publicationId: PublicationId;
  purchaseId: PurchaseId;
  channel: Platform;
  grossCents: number;
  feesCents: number; // Processor fees (Stripe, App Store, etc.)
  platformCutCents: number; // Platform revenue share
  sellerCutCents: number; // Amount paid to seller
  payoutId?: string; // Reference to Stripe payout
} & Timestamps;

// Stripe Checkout session creation params
export type CheckoutSessionParams = {
  customerId?: string;
  lineItems: LineItem[];
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
};

// RevenueCat purchase info
export type RevenueCatPurchase = {
  productId: string;
  transactionId: string;
  originalTransactionId: string;
  purchaseDateMs: number;
  expirationDateMs?: number;
  isTrialPeriod: boolean;
  isIntroOfferPeriod: boolean;
};

// Admin pricing configuration
export type PricingConfig = {
  baseIntroWebCents: number; // $1 default
  baseStandardWebCents: number; // $3 default
  elevenlabsSetupFeeCents: number;
  generatedTonesPricing: {
    solfeggioCents: number;
    binauralCents: number;
  };
  nativeTiersMap: Record<string, number>; // Maps web cents to IAP tier
  introSkuEnabled: boolean;
  sellerSharePercentage: {
    web: number; // Default 70%
    native: number; // Accounting for store fees
  };
};

// Seller earnings dashboard data
export type SellerEarnings = {
  totalEarnings: number;
  webEarnings: number;
  nativeEarnings: number;
  pendingPayout: number;
  lastPayoutDate?: string;
  nextPayoutDate?: string;
  totalSales: number;
  monthlyBreakdown: Array<{
    month: string;
    earnings: number;
    sales: number;
  }>;
};