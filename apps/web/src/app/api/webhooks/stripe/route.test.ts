import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";

// Mock Stripe
vi.mock("stripe", () => {
  const mockStripe = {
    webhooks: {
      constructEvent: vi.fn(),
    },
  };
  return {
    default: vi.fn(() => mockStripe),
  };
});

// Mock Supabase
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
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
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(),
          })),
        })),
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  })),
}));

describe("Stripe Webhook Handler", () => {
  let mockSupabase: any;
  let mockStripe: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createClient();
    mockStripe = new (Stripe as any)();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test123";
  });

  describe("POST /api/webhooks/stripe", () => {
    it("should handle checkout.session.completed event", async () => {
      // Arrange
      const mockEvent = {
        id: "evt_123",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_123",
            payment_intent: "pi_123",
            amount_total: 1500,
            currency: "usd",
            customer_email: "buyer@example.com",
            metadata: {
              userId: "user123",
              trackId: "track456",
              sellerId: "seller789",
            },
            line_items: {
              data: [
                {
                  price: { unit_amount: 1500 },
                  quantity: 1,
                },
              ],
            },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      // Mock idempotency check
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "webhook_events") {
          return {
            select: () => ({
              eq: () => ({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: "PGRST116" }, // Not found
                }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "webhook123" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "purchases") {
          return {
            insert: () => ({
              select: () => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "purchase123" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "earnings_ledger") {
          return {
            insert: () => ({
              select: () => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "earnings123" },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const request = new Request("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mockEvent),
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalled();
    });

    it("should handle account.updated event for Connect accounts", async () => {
      // Arrange
      const mockEvent = {
        id: "evt_456",
        type: "account.updated",
        account: "acct_123456789",
        data: {
          object: {
            id: "acct_123456789",
            charges_enabled: true,
            payouts_enabled: true,
            details_submitted: true,
            requirements: {
              currently_due: [],
              past_due: [],
              eventually_due: [],
            },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "webhook_events") {
          return {
            select: () => ({
              eq: () => ({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: "PGRST116" },
                }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "webhook456" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "seller_agreements") {
          return {
            update: () => ({
              eq: () => ({
                select: () => ({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "agreement123" },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const request = new Request("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mockEvent),
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(mockSupabase.from).toHaveBeenCalledWith("seller_agreements");
    });

    it("should handle transfer.created event for payouts", async () => {
      // Arrange
      const mockEvent = {
        id: "evt_789",
        type: "transfer.created",
        data: {
          object: {
            id: "tr_123",
            amount: 8500, // $85.00
            currency: "usd",
            destination: "acct_123456789",
            metadata: {
              sellerId: "seller789",
              periodStart: "2024-01-01T00:00:00Z",
              periodEnd: "2024-01-07T23:59:59Z",
            },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "webhook_events") {
          return {
            select: () => ({
              eq: () => ({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: "PGRST116" },
                }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "webhook789" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "payouts") {
          return {
            insert: () => ({
              select: () => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "payout123" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "earnings_ledger") {
          return {
            update: () => ({
              eq: () => ({
                select: () => ({
                  single: vi.fn().mockResolvedValue({
                    data: { updated: true },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const request = new Request("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mockEvent),
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(mockSupabase.from).toHaveBeenCalledWith("payouts");
    });

    it("should implement idempotency to prevent duplicate processing", async () => {
      // Arrange
      const mockEvent = {
        id: "evt_duplicate",
        type: "checkout.session.completed",
        data: { object: {} },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      // Mock that event already exists
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "webhook_events") {
          return {
            select: () => ({
              eq: () => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "existing_webhook", event_id: "evt_duplicate" },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const request = new Request("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mockEvent),
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(data.duplicate).toBe(true);
    });

    it("should verify webhook signature and reject invalid signatures", async () => {
      // Arrange
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error("Webhook signature verification failed");
      });

      const request = new Request("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        headers: {
          "stripe-signature": "invalid_sig",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: "evt_fake" }),
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toContain("signature");
    });

    it("should calculate platform fees correctly (15%)", async () => {
      // Arrange
      const mockEvent = {
        id: "evt_fee_calc",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_fee",
            payment_intent: "pi_fee",
            amount_total: 10000, // $100.00
            currency: "usd",
            metadata: {
              userId: "user123",
              trackId: "track456",
              sellerId: "seller789",
            },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      let capturedEarnings: any = null;

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "webhook_events") {
          return {
            select: () => ({
              eq: () => ({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: "PGRST116" },
                }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "webhook_fee" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "purchases") {
          return {
            insert: () => ({
              select: () => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "purchase_fee" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "earnings_ledger") {
          return {
            insert: vi.fn((data: any) => {
              capturedEarnings = data;
              return {
                select: () => ({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "earnings_fee" },
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        if (table === "seller_agreements") {
          return {
            select: () => ({
              eq: () => ({
                single: vi.fn().mockResolvedValue({
                  data: { platform_fee_percent: 15 },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const request = new Request("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mockEvent),
      });

      // Act
      await POST(request);

      // Assert
      expect(capturedEarnings).toBeTruthy();
      expect(capturedEarnings.gross_cents).toBe(10000);
      expect(capturedEarnings.platform_fee_cents).toBe(1500); // 15% of $100
      expect(capturedEarnings.seller_earnings_cents).toBe(8500); // $85
    });
  });
});