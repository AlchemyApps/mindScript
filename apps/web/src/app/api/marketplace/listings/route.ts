import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { 
  MarketplaceListingParamsSchema,
  MarketplaceResponseSchema,
  getCategoryLabel,
  getCategoryIcon,
  formatPrice,
  type MarketplaceCategory,
  type CategoryWithCount,
} from "@mindscript/schemas";
import { z } from "zod";

// Parse query parameters from URL
function parseQueryParams(url: URL): Record<string, any> {
  const params: Record<string, any> = {};
  
  url.searchParams.forEach((value, key) => {
    // Handle array parameters like categories[] and tags[]
    if (key.endsWith("[]")) {
      const cleanKey = key.slice(0, -2);
      if (!params[cleanKey]) {
        params[cleanKey] = [];
      }
      params[cleanKey].push(value);
    }
    // Handle nested object parameters like priceRange[min]
    else if (key.includes("[") && key.includes("]")) {
      const match = key.match(/^([^\[]+)\[([^\]]+)\]$/);
      if (match) {
        const [, objKey, propKey] = match;
        if (!params[objKey]) {
          params[objKey] = {};
        }
        // Convert to number if it looks like a number
        const numValue = Number(value);
        params[objKey][propKey] = !isNaN(numValue) ? numValue : value;
      }
    }
    // Regular parameters
    else {
      // Convert to number if it looks like a number
      const numValue = Number(value);
      params[key] = !isNaN(numValue) && value !== "" ? numValue : value;
    }
  });
  
  return params;
}

// Decode cursor for pagination
function decodeCursor(cursor: string | undefined): { created_at: string; id: string } | null {
  if (!cursor) return null;
  
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

// Encode cursor for pagination
function encodeCursor(created_at: string, id: string): string {
  return Buffer.from(JSON.stringify({ created_at, id })).toString("base64");
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const rawParams = parseQueryParams(url);
    
    // Validate parameters
    const validationResult = MarketplaceListingParamsSchema.safeParse(rawParams);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: validationResult.error.flatten() },
        { status: 400 }
      );
    }
    
    const params = validationResult.data;
    const supabase = await createClient();
    
    // Build base query for tracks
    let query = supabase
      .from("tracks")
      .select(`
        *,
        owner:profiles!user_id (
          id,
          display_name,
          avatar_url
        )
      `, { count: "exact" })
      .eq("status", "published")
      .is("deleted_at", null);
    
    // Apply search filter
    if (params.search) {
      query = query.or(`title.ilike.%${params.search}%,description.ilike.%${params.search}%`);
    }
    
    // Apply category filter
    if (params.category) {
      query = query.eq("category", params.category);
    } else if (params.categories && params.categories.length > 0) {
      query = query.in("category", params.categories);
    }
    
    // Apply tags filter
    if (params.tags && params.tags.length > 0) {
      query = query.contains("tags", params.tags);
    }
    
    // Apply price range filter
    if (params.priceRange) {
      if (params.priceRange.min !== undefined) {
        query = query.gte("price_cents", params.priceRange.min);
      }
      if (params.priceRange.max !== undefined) {
        query = query.lte("price_cents", params.priceRange.max);
      }
    }
    
    // Apply duration range filter
    if (params.durationRange) {
      if (params.durationRange.min !== undefined) {
        query = query.gte("duration_seconds", params.durationRange.min);
      }
      if (params.durationRange.max !== undefined) {
        query = query.lte("duration_seconds", params.durationRange.max);
      }
    }
    
    // Apply sorting
    switch (params.sort) {
      case "popular":
        query = query.order("play_count", { ascending: false });
        break;
      case "newest":
        query = query.order("created_at", { ascending: false });
        break;
      case "price_low":
        query = query.order("price_cents", { ascending: true });
        break;
      case "price_high":
        query = query.order("price_cents", { ascending: false });
        break;
      case "rating":
        // For future implementation when ratings are available
        query = query.order("created_at", { ascending: false });
        break;
    }
    
    // Apply cursor-based pagination
    const cursor = decodeCursor(params.cursor);
    if (cursor) {
      query = query.gte("created_at", cursor.created_at);
      if (params.sort === "newest") {
        query = query.lt("id", cursor.id);
      }
    }
    
    // Apply limit
    const limit = params.limit || 20;
    query = query.limit(limit + 1); // Fetch one extra to check if there's a next page
    
    // Execute query
    const { data: tracks, error, count } = await query;
    
    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch marketplace listings" },
        { status: 500 }
      );
    }
    
    // Check if there's a next page
    const hasNext = tracks && tracks.length > limit;
    if (hasNext && tracks) {
      tracks.pop(); // Remove the extra item
    }
    
    // Generate next cursor
    let nextCursor: string | undefined;
    if (hasNext && tracks && tracks.length > 0) {
      const lastTrack = tracks[tracks.length - 1];
      nextCursor = encodeCursor(lastTrack.created_at, lastTrack.id);
    }
    
    // Get category counts for filters (only on first page)
    let categoryFilters: CategoryWithCount[] = [];
    if (!params.cursor) {
      const { data: categoryCounts } = await supabase
        .from("tracks")
        .select("category")
        .eq("status", "published")
        .is("deleted_at", null);
      
      if (categoryCounts) {
        const counts = categoryCounts.reduce((acc, track) => {
          const cat = track.category as MarketplaceCategory;
          acc[cat] = (acc[cat] || 0) + 1;
          return acc;
        }, {} as Record<MarketplaceCategory, number>);
        
        categoryFilters = Object.entries(counts).map(([category, count]) => ({
          name: category as MarketplaceCategory,
          label: getCategoryLabel(category as MarketplaceCategory),
          count,
          icon: getCategoryIcon(category as MarketplaceCategory),
        }));
      }
    }
    
    // Get price range for filters (only on first page)
    let priceRange = { min: 0, max: 10000 };
    if (!params.cursor) {
      const { data: priceData } = await supabase
        .from("tracks")
        .select("price_cents")
        .eq("status", "published")
        .is("deleted_at", null)
        .order("price_cents", { ascending: true });
      
      if (priceData && priceData.length > 0) {
        priceRange = {
          min: priceData[0].price_cents || 0,
          max: priceData[priceData.length - 1].price_cents || 10000,
        };
      }
    }
    
    // Get duration range for filters (only on first page)
    let durationRange = { min: 0, max: 900 };
    if (!params.cursor) {
      const { data: durationData } = await supabase
        .from("tracks")
        .select("duration_seconds")
        .eq("status", "published")
        .is("deleted_at", null)
        .order("duration_seconds", { ascending: true });
      
      if (durationData && durationData.length > 0) {
        durationRange = {
          min: durationData[0].duration_seconds || 0,
          max: durationData[durationData.length - 1].duration_seconds || 900,
        };
      }
    }
    
    // Format tracks for response with preview URLs
    const formattedTracks = await Promise.all((tracks || []).map(async (track: any) => {
      let preview_url: string | undefined;

      // Generate signed URL for preview if preview file exists
      if (track.preview_url) {
        const { data } = await supabase.storage
          .from('tracks-public')
          .createSignedUrl(track.preview_url, 3600); // 1 hour expiry

        preview_url = data?.signedUrl;
      } else if (track.audio_url) {
        // Fallback to main audio URL if no preview (temporary)
        const { data } = await supabase.storage
          .from('tracks-private')
          .createSignedUrl(track.audio_url, 300); // 5 minutes for preview

        preview_url = data?.signedUrl;
      }

      return {
        ...track,
        formatted_price: formatPrice(track.price_cents || 0),
        preview_url,
        seller: {
          id: track.owner?.id || track.user_id,
          display_name: track.owner?.display_name || "Unknown Seller",
          avatar_url: track.owner?.avatar_url,
          // badge and rating will be added when seller verification is implemented
        },
      };
    }));
    
    // Build response
    const response = {
      tracks: formattedTracks,
      pagination: {
        cursor: nextCursor,
        has_next: hasNext,
        has_prev: !!params.cursor,
        total_count: count,
      },
      filters: !params.cursor ? {
        categories: categoryFilters,
        price_range: priceRange,
        duration_range: durationRange,
      } : undefined,
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}