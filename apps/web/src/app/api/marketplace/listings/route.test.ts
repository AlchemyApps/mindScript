import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { createClient } from "@/lib/supabase/server";

// Mock Supabase
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("/api/marketplace/listings", () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      data: null,
      error: null,
      count: null,
    };

    vi.mocked(createClient).mockReturnValue(mockSupabase as any);
  });

  describe("GET", () => {
    it("should return paginated marketplace listings", async () => {
      const mockTracks = [
        {
          id: "track-1",
          title: "Meditation Track",
          description: "A calming meditation",
          price_cents: 499,
          status: "published",
          category: "meditation",
          tags: ["calm", "peace"],
          duration_seconds: 600,
          play_count: 100,
          user_id: "seller-1",
          created_at: new Date().toISOString(),
          owner: {
            id: "seller-1",
            display_name: "John Doe",
            avatar_url: "https://example.com/avatar.jpg",
          },
        },
      ];

      mockSupabase.select.mockReturnValue({
        ...mockSupabase,
        data: mockTracks,
        error: null,
        count: 1,
      });

      const request = new NextRequest("http://localhost:3000/api/marketplace/listings");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tracks).toHaveLength(1);
      expect(data.tracks[0].title).toBe("Meditation Track");
      expect(data.pagination).toBeDefined();
      expect(data.pagination.has_next).toBe(false);
    });

    it("should filter by category", async () => {
      mockSupabase.select.mockReturnValue({
        ...mockSupabase,
        data: [],
        error: null,
        count: 0,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/marketplace/listings?category=meditation"
      );
      await GET(request);

      expect(mockSupabase.eq).toHaveBeenCalledWith("category", "meditation");
    });

    it("should filter by search query", async () => {
      mockSupabase.select.mockReturnValue({
        ...mockSupabase,
        data: [],
        error: null,
        count: 0,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/marketplace/listings?search=relax"
      );
      await GET(request);

      expect(mockSupabase.ilike).toHaveBeenCalled();
    });

    it("should filter by price range", async () => {
      mockSupabase.select.mockReturnValue({
        ...mockSupabase,
        data: [],
        error: null,
        count: 0,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/marketplace/listings?priceRange[min]=100&priceRange[max]=1000"
      );
      await GET(request);

      expect(mockSupabase.gte).toHaveBeenCalledWith("price_cents", 100);
      expect(mockSupabase.lte).toHaveBeenCalledWith("price_cents", 1000);
    });

    it("should sort by popular (play_count)", async () => {
      mockSupabase.select.mockReturnValue({
        ...mockSupabase,
        data: [],
        error: null,
        count: 0,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/marketplace/listings?sort=popular"
      );
      await GET(request);

      expect(mockSupabase.order).toHaveBeenCalledWith("play_count", { ascending: false });
    });

    it("should sort by price_low", async () => {
      mockSupabase.select.mockReturnValue({
        ...mockSupabase,
        data: [],
        error: null,
        count: 0,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/marketplace/listings?sort=price_low"
      );
      await GET(request);

      expect(mockSupabase.order).toHaveBeenCalledWith("price_cents", { ascending: true });
    });

    it("should handle pagination with cursor", async () => {
      mockSupabase.select.mockReturnValue({
        ...mockSupabase,
        data: [],
        error: null,
        count: 0,
      });

      const cursor = Buffer.from(JSON.stringify({ created_at: "2024-01-01", id: "abc" })).toString("base64");
      const request = new NextRequest(
        `http://localhost:3000/api/marketplace/listings?cursor=${cursor}`
      );
      await GET(request);

      expect(mockSupabase.gte).toHaveBeenCalled();
    });

    it("should only return published tracks", async () => {
      mockSupabase.select.mockReturnValue({
        ...mockSupabase,
        data: [],
        error: null,
        count: 0,
      });

      const request = new NextRequest("http://localhost:3000/api/marketplace/listings");
      await GET(request);

      expect(mockSupabase.eq).toHaveBeenCalledWith("status", "published");
    });

    it("should handle database errors", async () => {
      mockSupabase.select.mockReturnValue({
        ...mockSupabase,
        data: null,
        error: { message: "Database error" },
      });

      const request = new NextRequest("http://localhost:3000/api/marketplace/listings");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch marketplace listings");
    });

    it("should validate query parameters", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/marketplace/listings?limit=200" // exceeds max
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it("should include category counts in filters", async () => {
      const mockTracks = [
        {
          id: "track-1",
          category: "meditation",
          status: "published",
          // ... other fields
        },
      ];

      mockSupabase.select.mockReturnValue({
        ...mockSupabase,
        data: mockTracks,
        error: null,
        count: 1,
      });

      const request = new NextRequest("http://localhost:3000/api/marketplace/listings");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.filters).toBeDefined();
      expect(data.filters.categories).toBeDefined();
    });

    it("should filter by multiple categories", async () => {
      mockSupabase.select.mockReturnValue({
        ...mockSupabase,
        data: [],
        error: null,
        count: 0,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/marketplace/listings?categories[]=meditation&categories[]=sleep"
      );
      await GET(request);

      expect(mockSupabase.in).toHaveBeenCalledWith("category", ["meditation", "sleep"]);
    });

    it("should filter by tags", async () => {
      mockSupabase.select.mockReturnValue({
        ...mockSupabase,
        data: [],
        error: null,
        count: 0,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/marketplace/listings?tags[]=calm&tags[]=peace"
      );
      await GET(request);

      expect(mockSupabase.contains).toHaveBeenCalledWith(["calm", "peace"]);
    });

    it("should filter by duration range", async () => {
      mockSupabase.select.mockReturnValue({
        ...mockSupabase,
        data: [],
        error: null,
        count: 0,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/marketplace/listings?durationRange[min]=300&durationRange[max]=900"
      );
      await GET(request);

      expect(mockSupabase.gte).toHaveBeenCalledWith("duration_seconds", 300);
      expect(mockSupabase.lte).toHaveBeenCalledWith("duration_seconds", 900);
    });
  });
});