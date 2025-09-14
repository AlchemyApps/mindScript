import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST, GET } from "./route";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";

// Mock Stripe
vi.mock("stripe", () => {
  const mockStripe = {
    accounts: {
      create: vi.fn(),
      retrieve: vi.fn(),
    },
    accountLinks: {
      create: vi.fn(),
    },
  };
  return {
    default: vi.fn(() => mockStripe),
  };
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
        single: vi.fn(),
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
    })),
  })),
}));

describe("Seller Connect API Routes", () => {
  let mockSupabase: any;
  let mockStripe: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createClient();
    mockStripe = new (Stripe as any)();
  });

  describe("POST /api/seller/connect", () => {
    it("should create a new Connect Express account for authenticated user", async () => {
      // Arrange
      const mockUser = { id: "user123", email: "seller@example.com" };
      const mockProfile = { 
        id: "user123", 
        display_name: "Test Seller",
        email: "seller@example.com" 
      };
      const mockConnectAccount = { 
        id: "acct_123456789",
        type: "express",
        charges_enabled: false,
        payouts_enabled: false,
      };
      const mockAccountLink = {
        url: "https://connect.stripe.com/setup/e/1234",
        expires_at: Date.now() + 3600000,
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                single: vi.fn().mockResolvedValue({
                  data: mockProfile,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "seller_agreements") {
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
                  data: {
                    id: "agreement123",
                    user_id: mockUser.id,
                    stripe_connect_account_id: mockConnectAccount.id,
                    status: "pending_onboarding",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      mockStripe.accounts.create.mockResolvedValue(mockConnectAccount);
      mockStripe.accountLinks.create.mockResolvedValue(mockAccountLink);

      const request = new Request("http://localhost:3000/api/seller/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "192.168.1.1",
        },
        body: JSON.stringify({
          returnUrl: "http://localhost:3000/seller/dashboard",
          refreshUrl: "http://localhost:3000/seller/onboarding",
        }),
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        accountId: mockConnectAccount.id,
        onboardingUrl: mockAccountLink.url,
      });

      expect(mockStripe.accounts.create).toHaveBeenCalledWith({
        type: "express",
        email: mockUser.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        business_profile: {
          name: mockProfile.display_name,
          product_description: "Digital audio tracks and meditation content on MindScript",
        },
        settings: {
          payouts: {
            schedule: {
              interval: "weekly",
              weekly_anchor: "monday",
            },
          },
        },
      });

      expect(mockStripe.accountLinks.create).toHaveBeenCalledWith({
        account: mockConnectAccount.id,
        refresh_url: "http://localhost:3000/seller/onboarding",
        return_url: "http://localhost:3000/seller/dashboard",
        type: "account_onboarding",
      });
    });

    it("should return existing account link if seller agreement already exists", async () => {
      // Arrange
      const mockUser = { id: "user123", email: "seller@example.com" };
      const mockExistingAgreement = {
        id: "agreement123",
        user_id: mockUser.id,
        stripe_connect_account_id: "acct_existing",
        status: "onboarding_incomplete",
      };
      const mockAccountLink = {
        url: "https://connect.stripe.com/setup/e/5678",
        expires_at: Date.now() + 3600000,
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "seller_agreements") {
          return {
            select: () => ({
              eq: () => ({
                single: vi.fn().mockResolvedValue({
                  data: mockExistingAgreement,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      mockStripe.accountLinks.create.mockResolvedValue(mockAccountLink);

      const request = new Request("http://localhost:3000/api/seller/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnUrl: "http://localhost:3000/seller/dashboard",
          refreshUrl: "http://localhost:3000/seller/onboarding",
        }),
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.accountId).toBe(mockExistingAgreement.stripe_connect_account_id);
      expect(mockStripe.accounts.create).not.toHaveBeenCalled();
      expect(mockStripe.accountLinks.create).toHaveBeenCalled();
    });

    it("should return 401 if user is not authenticated", async () => {
      // Arrange
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error("Not authenticated"),
      });

      const request = new Request("http://localhost:3000/api/seller/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnUrl: "http://localhost:3000/seller/dashboard",
          refreshUrl: "http://localhost:3000/seller/onboarding",
        }),
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should validate required fields in request body", async () => {
      // Arrange
      const mockUser = { id: "user123", email: "seller@example.com" };
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const request = new Request("http://localhost:3000/api/seller/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Missing required fields
        }),
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toContain("validation");
    });
  });

  describe("GET /api/seller/connect", () => {
    it("should retrieve Connect account status for authenticated seller", async () => {
      // Arrange
      const mockUser = { id: "user123" };
      const mockAgreement = {
        id: "agreement123",
        user_id: mockUser.id,
        stripe_connect_account_id: "acct_123456789",
        status: "active",
      };
      const mockStripeAccount = {
        id: "acct_123456789",
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        requirements: {
          currently_due: [],
          eventually_due: [],
          past_due: [],
          disabled_reason: null,
        },
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.from.mockImplementation(() => ({
        select: () => ({
          eq: () => ({
            single: vi.fn().mockResolvedValue({
              data: mockAgreement,
              error: null,
            }),
          }),
        }),
      }));

      mockStripe.accounts.retrieve.mockResolvedValue(mockStripeAccount);

      const request = new Request("http://localhost:3000/api/seller/connect", {
        method: "GET",
      });

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        accountId: mockStripeAccount.id,
        detailsSubmitted: true,
        chargesEnabled: true,
        payoutsEnabled: true,
        requirementsCurrentlyDue: [],
      });

      expect(mockStripe.accounts.retrieve).toHaveBeenCalledWith(
        mockAgreement.stripe_connect_account_id
      );
    });

    it("should return 404 if no seller agreement exists", async () => {
      // Arrange
      const mockUser = { id: "user123" };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.from.mockImplementation(() => ({
        select: () => ({
          eq: () => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST116" },
            }),
          }),
        }),
      }));

      const request = new Request("http://localhost:3000/api/seller/connect", {
        method: "GET",
      });

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(data.error).toBe("No seller agreement found");
    });

    it("should update agreement status if Stripe status has changed", async () => {
      // Arrange
      const mockUser = { id: "user123" };
      const mockAgreement = {
        id: "agreement123",
        user_id: mockUser.id,
        stripe_connect_account_id: "acct_123456789",
        status: "pending_onboarding",
        charges_enabled: false,
        payouts_enabled: false,
      };
      const mockStripeAccount = {
        id: "acct_123456789",
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        requirements: {
          currently_due: [],
          eventually_due: [],
          past_due: [],
          disabled_reason: null,
        },
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "seller_agreements") {
          return {
            select: () => ({
              eq: () => ({
                single: vi.fn().mockResolvedValue({
                  data: mockAgreement,
                  error: null,
                }),
              }),
            }),
            update: () => ({
              eq: () => ({
                select: () => ({
                  single: vi.fn().mockResolvedValue({
                    data: { ...mockAgreement, status: "active" },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      mockStripe.accounts.retrieve.mockResolvedValue(mockStripeAccount);

      const request = new Request("http://localhost:3000/api/seller/connect", {
        method: "GET",
      });

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(200);
      expect(mockSupabase.from).toHaveBeenCalledWith("seller_agreements");
    });
  });
});