import { describe, it, expect } from "vitest";
import {
  CartItemSchema,
  CreateCheckoutSessionRequestSchema,
  CheckoutSessionResponseSchema,
  PurchaseRecordSchema,
  PurchaseItemSchema,
  TrackAccessSchema,
  WebhookEventSchema,
  calculatePlatformFee,
  calculateSellerEarnings,
} from "./checkout";

describe("Checkout Schemas", () => {
  describe("CartItemSchema", () => {
    it("should validate a valid cart item", () => {
      const validItem = {
        trackId: "550e8400-e29b-41d4-a716-446655440000",
        sellerId: "user_123456789",
        title: "Relaxing Morning Meditation",
        price: 299, // $2.99
        sellerConnectAccountId: "acct_1234567890",
      };

      const result = CartItemSchema.safeParse(validItem);
      expect(result.success).toBe(true);
    });

    it("should require positive price", () => {
      const invalidItem = {
        trackId: "550e8400-e29b-41d4-a716-446655440000",
        sellerId: "user_123456789",
        title: "Test Track",
        price: -100,
        sellerConnectAccountId: "acct_1234567890",
      };

      const result = CartItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
    });

    it("should require non-empty title", () => {
      const invalidItem = {
        trackId: "550e8400-e29b-41d4-a716-446655440000",
        sellerId: "user_123456789",
        title: "",
        price: 299,
        sellerConnectAccountId: "acct_1234567890",
      };

      const result = CartItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
    });
  });

  describe("CreateCheckoutSessionRequestSchema", () => {
    it("should validate a valid checkout request", () => {
      const validRequest = {
        items: [
          {
            trackId: "550e8400-e29b-41d4-a716-446655440000",
            sellerId: "user_123456789",
            title: "Track 1",
            price: 299,
            sellerConnectAccountId: "acct_1234567890",
          },
        ],
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        customerEmail: "test@example.com",
      };

      const result = CreateCheckoutSessionRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it("should require at least one item", () => {
      const invalidRequest = {
        items: [],
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      };

      const result = CreateCheckoutSessionRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it("should limit maximum items to 50", () => {
      const items = Array(51).fill({
        trackId: "550e8400-e29b-41d4-a716-446655440000",
        sellerId: "user_123456789",
        title: "Track",
        price: 299,
        sellerConnectAccountId: "acct_1234567890",
      });

      const invalidRequest = {
        items,
      };

      const result = CreateCheckoutSessionRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it("should validate email format", () => {
      const invalidRequest = {
        items: [
          {
            trackId: "550e8400-e29b-41d4-a716-446655440000",
            sellerId: "user_123456789",
            title: "Track",
            price: 299,
            sellerConnectAccountId: "acct_1234567890",
          },
        ],
        customerEmail: "invalid-email",
      };

      const result = CreateCheckoutSessionRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
  });

  describe("PurchaseRecordSchema", () => {
    it("should validate a valid purchase record", () => {
      const validPurchase = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        user_id: "user_123456789",
        session_id: "session_abc123",
        stripe_payment_intent_id: "pi_1234567890",
        stripe_checkout_session_id: "cs_test_1234567890",
        amount_total: 299,
        currency: "USD",
        status: "succeeded",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        completed_at: "2024-01-01T00:01:00Z",
        refunded_at: null,
        refund_amount: null,
      };

      const result = PurchaseRecordSchema.safeParse(validPurchase);
      expect(result.success).toBe(true);
    });

    it("should allow null user_id for guest checkout", () => {
      const guestPurchase = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        user_id: null,
        session_id: "session_guest_123",
        stripe_payment_intent_id: "pi_1234567890",
        stripe_checkout_session_id: "cs_test_1234567890",
        amount_total: 299,
        currency: "USD",
        status: "succeeded",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        completed_at: "2024-01-01T00:01:00Z",
        refunded_at: null,
        refund_amount: null,
      };

      const result = PurchaseRecordSchema.safeParse(guestPurchase);
      expect(result.success).toBe(true);
    });

    it("should validate currency code length", () => {
      const invalidPurchase = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        user_id: "user_123456789",
        session_id: "session_abc123",
        stripe_payment_intent_id: "pi_1234567890",
        stripe_checkout_session_id: "cs_test_1234567890",
        amount_total: 299,
        currency: "US", // Invalid - should be 3 characters
        status: "succeeded",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        completed_at: "2024-01-01T00:01:00Z",
        refunded_at: null,
        refund_amount: null,
      };

      const result = PurchaseRecordSchema.safeParse(invalidPurchase);
      expect(result.success).toBe(false);
    });
  });

  describe("PurchaseItemSchema", () => {
    it("should validate a valid purchase item", () => {
      const validItem = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        purchase_id: "650e8400-e29b-41d4-a716-446655440000",
        track_id: "750e8400-e29b-41d4-a716-446655440000",
        seller_id: "user_123456789",
        price: 299,
        platform_fee: 45, // 15% of 299
        seller_earnings: 254,
        stripe_price_id: "price_1234567890",
        stripe_product_id: "prod_1234567890",
        created_at: "2024-01-01T00:00:00Z",
      };

      const result = PurchaseItemSchema.safeParse(validItem);
      expect(result.success).toBe(true);
    });

    it("should calculate correct platform fee and seller earnings", () => {
      const price = 299;
      const platformFee = calculatePlatformFee(price, 15);
      const sellerEarnings = calculateSellerEarnings(price, platformFee);

      expect(platformFee).toBe(44); // Floor of 299 * 0.15
      expect(sellerEarnings).toBe(255); // 299 - 44
    });
  });

  describe("TrackAccessSchema", () => {
    it("should validate a valid track access record", () => {
      const validAccess = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        user_id: "user_123456789",
        session_id: "session_abc123",
        track_id: "750e8400-e29b-41d4-a716-446655440000",
        purchase_id: "650e8400-e29b-41d4-a716-446655440000",
        granted_at: "2024-01-01T00:00:00Z",
        expires_at: null,
        revoked_at: null,
        access_type: "purchase",
      };

      const result = TrackAccessSchema.safeParse(validAccess);
      expect(result.success).toBe(true);
    });

    it("should allow different access types", () => {
      const giftAccess = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        user_id: "user_123456789",
        session_id: "session_abc123",
        track_id: "750e8400-e29b-41d4-a716-446655440000",
        purchase_id: "650e8400-e29b-41d4-a716-446655440000",
        granted_at: "2024-01-01T00:00:00Z",
        expires_at: null,
        revoked_at: null,
        access_type: "gift",
      };

      const result = TrackAccessSchema.safeParse(giftAccess);
      expect(result.success).toBe(true);
    });

    it("should allow null user_id for guest access", () => {
      const guestAccess = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        user_id: null,
        session_id: "session_guest_123",
        track_id: "750e8400-e29b-41d4-a716-446655440000",
        purchase_id: "650e8400-e29b-41d4-a716-446655440000",
        granted_at: "2024-01-01T00:00:00Z",
        expires_at: null,
        revoked_at: null,
        access_type: "purchase",
      };

      const result = TrackAccessSchema.safeParse(guestAccess);
      expect(result.success).toBe(true);
    });
  });

  describe("WebhookEventSchema", () => {
    it("should validate a valid webhook event", () => {
      const validEvent = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        stripe_event_id: "evt_1234567890",
        type: "checkout.session.completed",
        processed_at: "2024-01-01T00:00:00Z",
        data: {
          object: "checkout.session",
          id: "cs_test_1234567890",
        },
        status: "processed",
        error: null,
        retry_count: 0,
      };

      const result = WebhookEventSchema.safeParse(validEvent);
      expect(result.success).toBe(true);
    });

    it("should track retry count", () => {
      const failedEvent = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        stripe_event_id: "evt_1234567890",
        type: "checkout.session.completed",
        processed_at: "2024-01-01T00:00:00Z",
        data: {},
        status: "failed",
        error: "Connection timeout",
        retry_count: 3,
      };

      const result = WebhookEventSchema.safeParse(failedEvent);
      expect(result.success).toBe(true);
      expect(result.data?.retry_count).toBe(3);
    });
  });

  describe("Fee Calculations", () => {
    it("should calculate 15% platform fee correctly", () => {
      expect(calculatePlatformFee(100, 15)).toBe(15);
      expect(calculatePlatformFee(299, 15)).toBe(44); // Floor of 44.85
      expect(calculatePlatformFee(1000, 15)).toBe(150);
      expect(calculatePlatformFee(1599, 15)).toBe(239); // Floor of 239.85
    });

    it("should calculate seller earnings correctly", () => {
      const price1 = 100;
      const fee1 = calculatePlatformFee(price1, 15);
      expect(calculateSellerEarnings(price1, fee1)).toBe(85);

      const price2 = 299;
      const fee2 = calculatePlatformFee(price2, 15);
      expect(calculateSellerEarnings(price2, fee2)).toBe(255);

      const price3 = 1000;
      const fee3 = calculatePlatformFee(price3, 15);
      expect(calculateSellerEarnings(price3, fee3)).toBe(850);
    });

    it("should handle custom fee percentages", () => {
      expect(calculatePlatformFee(100, 10)).toBe(10);
      expect(calculatePlatformFee(100, 20)).toBe(20);
      expect(calculatePlatformFee(100, 25)).toBe(25);
    });

    it("should handle zero amounts", () => {
      expect(calculatePlatformFee(0, 15)).toBe(0);
      expect(calculateSellerEarnings(0, 0)).toBe(0);
    });
  });
});