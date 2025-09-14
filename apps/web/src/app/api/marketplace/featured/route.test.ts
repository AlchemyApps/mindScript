import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { createClient } from "@/lib/supabase/server";

// Mock Supabase
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("/api/marketplace/featured", () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      data: null,
      error: null,
    };

    vi.mocked(createClient).mockReturnValue(mockSupabase as any);
  });

  describe("GET", () => {
    it("should return featured, popular, and new tracks", async () => {
      const mockTrack = {
        id: "track-1",
        title: "Test Track",
        description: "Test description",
        price_cents: 499,
        status: "published",
        category: "meditation",
        play_count: 100,
        created_at: new Date().toISOString(),
        owner: {
          id: "seller-1",
          display_name: "Test Seller",
        },
      };

      // Mock featured tracks
      mockSupabase.select.mockReturnValueOnce({
        ...mockSupabase,
        data: [{ ...mockTrack, is_featured: true }],
        error: null,
      });

      // Mock popular tracks
      mockSupabase.select.mockReturnValueOnce({
        ...mockSupabase,
        data: [{ ...mockTrack, play_count: 1000 }],
        error: null,
      });

      // Mock new releases
      mockSupabase.select.mockReturnValueOnce({
        ...mockSupabase,
        data: [{ ...mockTrack, created_at: new Date().toISOString() }],
        error: null,
      });

      const request = new NextRequest("http://localhost:3000/api/marketplace/featured");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.featured).toBeDefined();
      expect(data.popular).toBeDefined();
      expect(data.new_releases).toBeDefined();
      expect(data.featured).toHaveLength(1);
      expect(data.popular).toHaveLength(1);
      expect(data.new_releases).toHaveLength(1);
    });

    it("should limit the number of tracks returned", async () => {
      mockSupabase.select.mockReturnValue({
        ...mockSupabase,
        data: [],
        error: null,
      });

      const request = new NextRequest("http://localhost:3000/api/marketplace/featured");
      await GET(request);

      // Should be called 3 times (featured, popular, new)
      expect(mockSupabase.limit).toHaveBeenCalledTimes(3);
      expect(mockSupabase.limit).toHaveBeenCalledWith(10);
    });

    it("should only return published tracks", async () => {
      mockSupabase.select.mockReturnValue({
        ...mockSupabase,
        data: [],
        error: null,
      });

      const request = new NextRequest("http://localhost:3000/api/marketplace/featured");
      await GET(request);

      expect(mockSupabase.eq).toHaveBeenCalledWith("status", "published");
      expect(mockSupabase.is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("should sort popular tracks by play_count", async () => {
      mockSupabase.select.mockReturnValue({
        ...mockSupabase,
        data: [],
        error: null,
      });

      const request = new NextRequest("http://localhost:3000/api/marketplace/featured");
      await GET(request);

      // Check that order was called with play_count for popular tracks
      const orderCalls = mockSupabase.order.mock.calls;
      expect(orderCalls.some((call: any[]) => 
        call[0] === "play_count" && call[1]?.ascending === false
      )).toBe(true);
    });

    it("should sort new releases by created_at", async () => {
      mockSupabase.select.mockReturnValue({
        ...mockSupabase,
        data: [],
        error: null,
      });

      const request = new NextRequest("http://localhost:3000/api/marketplace/featured");
      await GET(request);

      // Check that order was called with created_at for new releases
      const orderCalls = mockSupabase.order.mock.calls;
      expect(orderCalls.some((call: any[]) => 
        call[0] === "created_at" && call[1]?.ascending === false
      )).toBe(true);
    });

    it("should handle database errors gracefully", async () => {
      mockSupabase.select.mockReturnValue({
        ...mockSupabase,
        data: null,
        error: { message: "Database error" },
      });

      const request = new NextRequest("http://localhost:3000/api/marketplace/featured");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch featured tracks");
    });

    it("should return empty arrays when no tracks found", async () => {
      mockSupabase.select.mockReturnValue({
        ...mockSupabase,
        data: [],
        error: null,
      });

      const request = new NextRequest("http://localhost:3000/api/marketplace/featured");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.featured).toEqual([]);
      expect(data.popular).toEqual([]);
      expect(data.new_releases).toEqual([]);
    });

    it("should filter new releases to last 30 days", async () => {
      mockSupabase.select.mockReturnValue({
        ...mockSupabase,
        data: [],
        error: null,
      });

      const request = new NextRequest("http://localhost:3000/api/marketplace/featured");
      await GET(request);

      // Check that gte was called for date filtering
      expect(mockSupabase.gte).toHaveBeenCalled();
      const gteCall = mockSupabase.gte.mock.calls[0];
      expect(gteCall[0]).toBe("created_at");
      
      // Verify the date is approximately 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const calledDate = new Date(gteCall[1]);
      const daysDiff = Math.abs(thirtyDaysAgo.getTime() - calledDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeLessThan(1); // Allow for small time differences
    });
  });
});