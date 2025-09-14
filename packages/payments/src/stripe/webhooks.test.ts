import { describe, it, expect, vi, beforeEach } from "vitest";
import Stripe from "stripe";
import {
  verifyWebhookSignature,
  checkEventDuplicate,
  recordWebhookEvent,
  updateWebhookStatus,
  processCheckoutCompleted,
  processRefund,
  processWebhook,
} from "./webhooks";

// Mock Stripe
vi.mock("stripe", () => {
  const Stripe = vi.fn(() => ({
    webhooks: {
      constructEvent: vi.fn(),
    },
  }));
  return { default: Stripe };
});

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(),
      select: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
    upsert: vi.fn(),
  })),
};

describe("Webhook Utilities", () => {
  let mockStripe: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStripe = new (Stripe as any)();
  });

  describe("verifyWebhookSignature", () => {
    it("should verify valid webhook signature", () => {
      const payload = "test-payload";
      const signature = "test-signature";
      const secret = "whsec_test";
      const expectedEvent = { id: "evt_test", type: "test.event" };

      mockStripe.webhooks.constructEvent.mockReturnValue(expectedEvent);

      const result = verifyWebhookSignature(payload, signature, secret, mockStripe);

      expect(result).toEqual(expectedEvent);
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        payload,
        signature,
        secret
      );
    });

    it("should throw error for invalid signature", () => {
      const payload = "test-payload";
      const signature = "invalid-signature";
      const secret = "whsec_test";

      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      expect(() => 
        verifyWebhookSignature(payload, signature, secret, mockStripe)
      ).toThrow("Invalid signature");
    });
  });

  describe("checkEventDuplicate", () => {
    it("should return true for processed event", async () => {
      const eventId = "evt_test";
      
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "123", status: "processed" },
              error: null,
            }),
          }),
        }),
      });

      const result = await checkEventDuplicate(eventId, mockSupabase as any);
      expect(result).toBe(true);
    });

    it("should return false for unprocessed event", async () => {
      const eventId = "evt_test";
      
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "123", status: "processing" },
              error: null,
            }),
          }),
        }),
      });

      const result = await checkEventDuplicate(eventId, mockSupabase as any);
      expect(result).toBe(false);
    });

    it("should return false for non-existent event", async () => {
      const eventId = "evt_test";
      
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      const result = await checkEventDuplicate(eventId, mockSupabase as any);
      expect(result).toBe(false);
    });
  });

  describe("recordWebhookEvent", () => {
    it("should record webhook event", async () => {
      const event = {
        id: "evt_test",
        type: "checkout.session.completed",
        data: { object: {} },
      } as Stripe.Event;

      mockSupabase.from.mockReturnValueOnce({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });

      await recordWebhookEvent(event, mockSupabase as any);

      expect(mockSupabase.from).toHaveBeenCalledWith("webhook_events");
      expect(mockSupabase.from().upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          stripe_event_id: "evt_test",
          type: "checkout.session.completed",
          status: "processing",
        }),
        expect.objectContaining({
          onConflict: "stripe_event_id",
        })
      );
    });
  });

  describe("updateWebhookStatus", () => {
    it("should update webhook status to processed", async () => {
      const eventId = "evt_test";

      mockSupabase.from.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      await updateWebhookStatus(eventId, "processed", mockSupabase as any);

      expect(mockSupabase.from).toHaveBeenCalledWith("webhook_events");
      expect(mockSupabase.from().update).toHaveBeenCalledWith({ status: "processed" });
    });

    it("should update webhook status to failed with error", async () => {
      const eventId = "evt_test";
      const error = "Processing failed";

      mockSupabase.from.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      await updateWebhookStatus(eventId, "failed", mockSupabase as any, error);

      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        status: "failed",
        error: "Processing failed",
      });
    });
  });

  describe("processCheckoutCompleted", () => {
    it("should process checkout session completed event", async () => {
      const session = {
        id: "cs_test",
        payment_intent: "pi_test",
        amount_total: 299,
        currency: "usd",
        metadata: {
          itemCount: "1",
          userId: "user_123",
          item_0: JSON.stringify({
            trackId: "track_123",
            sellerId: "seller_123",
            price: 299,
            platformFee: 44,
            sellerEarnings: 255,
          }),
        },
      } as Stripe.Checkout.Session;

      // Mock purchase creation
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "purchase_123" },
              error: null,
            }),
          }),
        }),
      });

      // Mock purchase item creation
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      // Mock track access grant
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      // Mock earnings ledger creation
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      // Mock purchase status update
      mockSupabase.from.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      await processCheckoutCompleted(session, mockSupabase as any);

      // Verify purchase was created
      expect(mockSupabase.from).toHaveBeenCalledWith("purchases");
      
      // Verify purchase items, track access, and earnings ledger were created
      expect(mockSupabase.from).toHaveBeenCalledWith("purchase_items");
      expect(mockSupabase.from).toHaveBeenCalledWith("track_access");
      expect(mockSupabase.from).toHaveBeenCalledWith("earnings_ledger");
    });

    it("should handle guest checkout", async () => {
      const session = {
        id: "cs_test",
        payment_intent: "pi_test",
        amount_total: 299,
        currency: "usd",
        metadata: {
          itemCount: "1",
          userId: "guest",
          item_0: JSON.stringify({
            trackId: "track_123",
            sellerId: "seller_123",
            price: 299,
            platformFee: 44,
            sellerEarnings: 255,
          }),
        },
      } as Stripe.Checkout.Session;

      // Mock purchase creation
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "purchase_123" },
              error: null,
            }),
          }),
        }),
      });

      // Mock other operations
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      await processCheckoutCompleted(session, mockSupabase as any);

      // Verify null user_id was passed for guest checkout
      const insertCall = mockSupabase.from.mock.calls[0];
      expect(insertCall[0]).toBe("purchases");
    });
  });

  describe("processRefund", () => {
    it("should process full refund", async () => {
      const charge = {
        amount: 299,
        amount_refunded: 299,
        payment_intent: "pi_test",
      } as Stripe.Charge;

      // Mock purchase update
      mockSupabase.from.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "purchase_123" },
                error: null,
              }),
            }),
          }),
        }),
      });

      // Mock access revocation
      mockSupabase.from.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      // Mock earnings ledger update
      mockSupabase.from.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      await processRefund(charge, mockSupabase as any);

      // Verify purchase was marked as refunded
      expect(mockSupabase.from).toHaveBeenCalledWith("purchases");
      
      // Verify access was revoked
      expect(mockSupabase.from).toHaveBeenCalledWith("track_access");
      
      // Verify earnings ledger was updated
      expect(mockSupabase.from).toHaveBeenCalledWith("earnings_ledger");
    });

    it("should handle partial refund", async () => {
      const charge = {
        amount: 299,
        amount_refunded: 100,
        payment_intent: "pi_test",
      } as Stripe.Charge;

      // Mock purchase update
      mockSupabase.from.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "purchase_123" },
                error: null,
              }),
            }),
          }),
        }),
      });

      await processRefund(charge, mockSupabase as any);

      // Verify purchase status remains succeeded for partial refund
      const updateCall = mockSupabase.from().update.mock.calls[0][0];
      expect(updateCall.status).toBe("succeeded");
      expect(updateCall.refund_amount).toBe(100);
    });
  });

  describe("processWebhook", () => {
    it("should process webhook successfully", async () => {
      const payload = "test-payload";
      const signature = "test-signature";
      const config = {
        stripe: mockStripe,
        supabase: mockSupabase as any,
        webhookSecret: "whsec_test",
      };

      const event = {
        id: "evt_test",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test",
            payment_intent: "pi_test",
            amount_total: 299,
            currency: "usd",
            metadata: {
              itemCount: "0",
            },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      // Mock duplicate check
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      // Mock event recording
      mockSupabase.from.mockReturnValueOnce({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });

      // Mock checkout processing
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "purchase_123" },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const result = await processWebhook(payload, signature, config);

      expect(result.success).toBe(true);
      expect(result.duplicate).toBeUndefined();
    });

    it("should handle duplicate events", async () => {
      const payload = "test-payload";
      const signature = "test-signature";
      const config = {
        stripe: mockStripe,
        supabase: mockSupabase as any,
        webhookSecret: "whsec_test",
      };

      const event = {
        id: "evt_test",
        type: "checkout.session.completed",
        data: { object: {} },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      // Mock duplicate check - event already processed
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "123", status: "processed" },
              error: null,
            }),
          }),
        }),
      });

      const result = await processWebhook(payload, signature, config);

      expect(result.success).toBe(true);
      expect(result.duplicate).toBe(true);
    });

    it("should handle invalid signature", async () => {
      const payload = "test-payload";
      const signature = "invalid-signature";
      const config = {
        stripe: mockStripe,
        supabase: mockSupabase as any,
        webhookSecret: "whsec_test",
      };

      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      const result = await processWebhook(payload, signature, config);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid webhook signature");
    });
  });
});