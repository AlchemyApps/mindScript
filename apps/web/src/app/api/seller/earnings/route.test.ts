import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { createClient } from "@/lib/supabase/server";

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
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({
                data: [],
                error: null,
              })),
            })),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
    rpc: vi.fn(),
  })),
}));

describe("Seller Earnings API Routes", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createClient();
  });

  describe("GET /api/seller/earnings", () => {
    it("should return earnings summary for authenticated seller", async () => {
      // Arrange
      const mockUser = { id: "seller123" };
      const mockSummary = {
        total_earnings_cents: 50000, // $500
        pending_payout_cents: 15000, // $150
        completed_payouts_cents: 35000, // $350
        available_balance_cents: 15000, // $150
        platform_fees_cents: 7500, // $75
        processing_fees_cents: 1500, // $15
        last_payout_date: "2024-01-08T00:00:00Z",
        next_payout_date: "2024-01-15T00:00:00Z",
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.rpc.mockResolvedValue({
        data: [mockSummary],
        error: null,
      });

      const request = new Request("http://localhost:3000/api/seller/earnings", {
        method: "GET",
      });

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        totalEarningsCents: 50000,
        pendingPayoutCents: 15000,
        completedPayoutsCents: 35000,
        availableBalanceCents: 15000,
        platformFeesCents: 7500,
        processingFeesCents: 1500,
        currency: "USD",
        lastPayoutDate: "2024-01-08T00:00:00Z",
        nextPayoutDate: "2024-01-15T00:00:00Z",
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "get_seller_earnings_summary",
        { p_seller_id: mockUser.id }
      );
    });

    it("should return earnings by period when period parameter is provided", async () => {
      // Arrange
      const mockUser = { id: "seller123" };
      const mockEarnings = [
        {
          created_at: "2024-01-01T00:00:00Z",
          seller_earnings_cents: 1000,
          platform_fee_cents: 150,
        },
        {
          created_at: "2024-01-02T00:00:00Z",
          seller_earnings_cents: 2000,
          platform_fee_cents: 300,
        },
      ];

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.from.mockImplementation(() => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () => ({
                  then: (cb: any) => cb({
                    data: mockEarnings,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      }));

      const request = new Request(
        "http://localhost:3000/api/seller/earnings?period=daily&startDate=2024-01-01&endDate=2024-01-07",
        { method: "GET" }
      );

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.period).toBe("daily");
      expect(data.data).toHaveLength(2);
      expect(data.data[0]).toMatchObject({
        date: "2024-01-01T00:00:00Z",
        earningsCents: 1000,
        platformFeesCents: 150,
      });
    });

    it("should return 401 if user is not authenticated", async () => {
      // Arrange
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error("Not authenticated"),
      });

      const request = new Request("http://localhost:3000/api/seller/earnings", {
        method: "GET",
      });

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should export earnings as CSV when format=csv", async () => {
      // Arrange
      const mockUser = { id: "seller123" };
      const mockEarnings = [
        {
          created_at: "2024-01-01T10:00:00Z",
          track_id: "track1",
          track_title: "Meditation Track 1",
          gross_cents: 1500,
          platform_fee_cents: 225,
          processor_fee_cents: 75,
          seller_earnings_cents: 1200,
          payout_status: "paid",
        },
        {
          created_at: "2024-01-02T15:30:00Z",
          track_id: "track2",
          track_title: "Sleep Track 2",
          gross_cents: 2000,
          platform_fee_cents: 300,
          processor_fee_cents: 100,
          seller_earnings_cents: 1600,
          payout_status: "pending",
        },
      ];

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.from.mockImplementation(() => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () => ({
                  then: (cb: any) => cb({
                    data: mockEarnings,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      }));

      const request = new Request(
        "http://localhost:3000/api/seller/earnings?format=csv&startDate=2024-01-01&endDate=2024-01-31",
        { method: "GET" }
      );

      // Act
      const response = await GET(request);
      const csv = await response.text();

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/csv");
      expect(response.headers.get("Content-Disposition")).toContain("earnings_export");
      expect(csv).toContain("Date,Track,Gross,Platform Fee,Processing Fee,Net Earnings,Status");
      expect(csv).toContain("Meditation Track 1");
      expect(csv).toContain("$12.00");
    });
  });

  describe("POST /api/seller/earnings", () => {
    it("should create manual payout request if balance meets minimum", async () => {
      // Arrange
      const mockUser = { id: "seller123" };
      const mockSummary = {
        available_balance_cents: 5000, // $50
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.rpc.mockResolvedValue({
        data: [mockSummary],
        error: null,
      });

      mockSupabase.from.mockImplementation(() => ({
        insert: () => ({
          select: () => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: "payout123",
                amount_cents: 5000,
                status: "pending",
              },
              error: null,
            }),
          }),
        }),
      }));

      const request = new Request("http://localhost:3000/api/seller/earnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: 5000,
          reason: "manual",
        }),
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        payoutId: "payout123",
        amountCents: 5000,
        status: "pending",
      });
    });

    it("should reject payout request if amount is below minimum ($10)", async () => {
      // Arrange
      const mockUser = { id: "seller123" };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const request = new Request("http://localhost:3000/api/seller/earnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: 500, // $5, below minimum
          reason: "manual",
        }),
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toContain("Minimum payout");
    });

    it("should reject payout if insufficient balance", async () => {
      // Arrange
      const mockUser = { id: "seller123" };
      const mockSummary = {
        available_balance_cents: 1500, // $15
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.rpc.mockResolvedValue({
        data: [mockSummary],
        error: null,
      });

      const request = new Request("http://localhost:3000/api/seller/earnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: 5000, // $50, more than available
          reason: "manual",
        }),
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toBe("Insufficient balance");
    });
  });
});