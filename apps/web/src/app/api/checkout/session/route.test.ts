import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";

// Mock Stripe
vi.mock("stripe", () => {
  const Stripe = vi.fn(() => ({
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
    products: {
      create: vi.fn(),
    },
    prices: {
      create: vi.fn(),
    },
  }));
  return { default: Stripe };
});

// Mock Supabase
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
        in: vi.fn(() => ({
          data: [],
          error: null,
        })),
      })),
    })),
  })),
}));

describe("POST /api/checkout/session", () => {
  let mockStripe: any;
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStripe = new (Stripe as any)();
    mockSupabase = createClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should create a checkout session for a single track", async () => {
    const mockTrack = {
      id: "track-123",
      title: "Meditation Track",
      user_id: "seller-123",
      price_cents: 299,
    };

    const mockSellerAgreement = {
      user_id: "seller-123",
      stripe_connect_account_id: "acct_seller123",
    };

    // Mock track lookup
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [mockTrack],
          error: null,
        }),
      }),
    });

    // Mock seller agreement lookup
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [mockSellerAgreement],
          error: null,
        }),
      }),
    });

    // Mock Stripe product creation
    mockStripe.products.create.mockResolvedValue({
      id: "prod_123",
    });

    // Mock Stripe price creation
    mockStripe.prices.create.mockResolvedValue({
      id: "price_123",
    });

    // Mock Stripe checkout session creation
    mockStripe.checkout.sessions.create.mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/session/cs_test_123",
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    });

    const request = new NextRequest("http://localhost:3000/api/checkout/session", {
      method: "POST",
      body: JSON.stringify({
        items: [
          {
            trackId: "track-123",
            sellerId: "seller-123",
            title: "Meditation Track",
            price: 299,
            sellerConnectAccountId: "acct_seller123",
          },
        ],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("sessionId", "cs_test_123");
    expect(data).toHaveProperty("url");
    expect(data).toHaveProperty("expiresAt");

    // Verify Stripe product was created
    expect(mockStripe.products.create).toHaveBeenCalledWith({
      name: "Meditation Track",
      metadata: {
        trackId: "track-123",
        sellerId: "seller-123",
      },
    });

    // Verify Stripe price was created
    expect(mockStripe.prices.create).toHaveBeenCalledWith({
      product: "prod_123",
      unit_amount: 299,
      currency: "usd",
    });

    // Verify checkout session was created with destination charge
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        line_items: expect.arrayContaining([
          expect.objectContaining({
            price: "price_123",
            quantity: 1,
          }),
        ]),
        payment_intent_data: expect.objectContaining({
          application_fee_amount: 44, // 15% of 299
          transfer_data: {
            destination: "acct_seller123",
          },
        }),
      })
    );
  });

  it("should create a checkout session for multiple tracks", async () => {
    const mockTracks = [
      {
        id: "track-1",
        title: "Track 1",
        user_id: "seller-1",
        price_cents: 299,
      },
      {
        id: "track-2",
        title: "Track 2",
        user_id: "seller-2",
        price_cents: 499,
      },
    ];

    const mockSellerAgreements = [
      {
        user_id: "seller-1",
        stripe_connect_account_id: "acct_seller1",
      },
      {
        user_id: "seller-2",
        stripe_connect_account_id: "acct_seller2",
      },
    ];

    // Mock track lookup
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: mockTracks,
          error: null,
        }),
      }),
    });

    // Mock seller agreement lookup
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: mockSellerAgreements,
          error: null,
        }),
      }),
    });

    // Mock Stripe product/price creation for each item
    mockStripe.products.create
      .mockResolvedValueOnce({ id: "prod_1" })
      .mockResolvedValueOnce({ id: "prod_2" });

    mockStripe.prices.create
      .mockResolvedValueOnce({ id: "price_1" })
      .mockResolvedValueOnce({ id: "price_2" });

    // Mock Stripe checkout session creation
    mockStripe.checkout.sessions.create.mockResolvedValue({
      id: "cs_test_multi",
      url: "https://checkout.stripe.com/session/cs_test_multi",
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    });

    const request = new NextRequest("http://localhost:3000/api/checkout/session", {
      method: "POST",
      body: JSON.stringify({
        items: [
          {
            trackId: "track-1",
            sellerId: "seller-1",
            title: "Track 1",
            price: 299,
            sellerConnectAccountId: "acct_seller1",
          },
          {
            trackId: "track-2",
            sellerId: "seller-2",
            title: "Track 2",
            price: 499,
            sellerConnectAccountId: "acct_seller2",
          },
        ],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("sessionId", "cs_test_multi");

    // Verify products and prices were created for each item
    expect(mockStripe.products.create).toHaveBeenCalledTimes(2);
    expect(mockStripe.prices.create).toHaveBeenCalledTimes(2);
  });

  it("should validate cart items against database", async () => {
    // Mock track lookup with mismatched price
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [
            {
              id: "track-123",
              title: "Meditation Track",
              user_id: "seller-123",
              price_cents: 399, // Different from request
            },
          ],
          error: null,
        }),
      }),
    });

    const request = new NextRequest("http://localhost:3000/api/checkout/session", {
      method: "POST",
      body: JSON.stringify({
        items: [
          {
            trackId: "track-123",
            sellerId: "seller-123",
            title: "Meditation Track",
            price: 299, // Mismatched price
            sellerConnectAccountId: "acct_seller123",
          },
        ],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Price mismatch");
  });

  it("should handle missing seller Connect account", async () => {
    const mockTrack = {
      id: "track-123",
      title: "Meditation Track",
      user_id: "seller-123",
      price_cents: 299,
    };

    // Mock track lookup
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [mockTrack],
          error: null,
        }),
      }),
    });

    // Mock seller agreement lookup - no Connect account
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }),
    });

    const request = new NextRequest("http://localhost:3000/api/checkout/session", {
      method: "POST",
      body: JSON.stringify({
        items: [
          {
            trackId: "track-123",
            sellerId: "seller-123",
            title: "Meditation Track",
            price: 299,
            sellerConnectAccountId: "acct_seller123",
          },
        ],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Seller not found");
  });

  it("should include customer email if provided", async () => {
    const mockTrack = {
      id: "track-123",
      title: "Meditation Track",
      user_id: "seller-123",
      price_cents: 299,
    };

    const mockSellerAgreement = {
      user_id: "seller-123",
      stripe_connect_account_id: "acct_seller123",
    };

    // Mock track lookup
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [mockTrack],
          error: null,
        }),
      }),
    });

    // Mock seller agreement lookup
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [mockSellerAgreement],
          error: null,
        }),
      }),
    });

    // Mock Stripe calls
    mockStripe.products.create.mockResolvedValue({ id: "prod_123" });
    mockStripe.prices.create.mockResolvedValue({ id: "price_123" });
    mockStripe.checkout.sessions.create.mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/session/cs_test_123",
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    });

    const request = new NextRequest("http://localhost:3000/api/checkout/session", {
      method: "POST",
      body: JSON.stringify({
        items: [
          {
            trackId: "track-123",
            sellerId: "seller-123",
            title: "Meditation Track",
            price: 299,
            sellerConnectAccountId: "acct_seller123",
          },
        ],
        customerEmail: "customer@example.com",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    // Verify email was passed to Stripe
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_email: "customer@example.com",
      })
    );
  });

  it("should set proper success and cancel URLs", async () => {
    const mockTrack = {
      id: "track-123",
      title: "Meditation Track",
      user_id: "seller-123",
      price_cents: 299,
    };

    const mockSellerAgreement = {
      user_id: "seller-123",
      stripe_connect_account_id: "acct_seller123",
    };

    // Mock track lookup
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [mockTrack],
          error: null,
        }),
      }),
    });

    // Mock seller agreement lookup
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [mockSellerAgreement],
          error: null,
        }),
      }),
    });

    // Mock Stripe calls
    mockStripe.products.create.mockResolvedValue({ id: "prod_123" });
    mockStripe.prices.create.mockResolvedValue({ id: "price_123" });
    mockStripe.checkout.sessions.create.mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/session/cs_test_123",
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    });

    const request = new NextRequest("http://localhost:3000/api/checkout/session", {
      method: "POST",
      headers: {
        host: "example.com",
      },
      body: JSON.stringify({
        items: [
          {
            trackId: "track-123",
            sellerId: "seller-123",
            title: "Meditation Track",
            price: 299,
            sellerConnectAccountId: "acct_seller123",
          },
        ],
        successUrl: "https://example.com/checkout/success",
        cancelUrl: "https://example.com/checkout/cancel",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    // Verify URLs were passed to Stripe
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: expect.stringContaining("/checkout/success"),
        cancel_url: expect.stringContaining("/checkout/cancel"),
      })
    );
  });

  it("should reject empty cart", async () => {
    const request = new NextRequest("http://localhost:3000/api/checkout/session", {
      method: "POST",
      body: JSON.stringify({
        items: [],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("items");
  });

  it("should reject invalid item data", async () => {
    const request = new NextRequest("http://localhost:3000/api/checkout/session", {
      method: "POST",
      body: JSON.stringify({
        items: [
          {
            trackId: "not-a-uuid",
            sellerId: "seller-123",
            title: "",
            price: -100,
            sellerConnectAccountId: "",
          },
        ],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });
});