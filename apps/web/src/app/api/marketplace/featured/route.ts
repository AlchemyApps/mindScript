import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@mindscript/schemas";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Base query for published tracks
    const baseQuery = () => supabase
      .from("tracks")
      .select(`
        *,
        owner:profiles!user_id (
          id,
          display_name,
          avatar_url
        )
      `)
      .eq("status", "published")
      .is("deleted_at", null);
    
    // Get featured tracks (tracks marked as featured - this would need a database column)
    // For now, we'll get tracks with high play counts as "featured"
    const { data: featuredTracks, error: featuredError } = await baseQuery()
      .order("play_count", { ascending: false })
      .limit(10);
    
    if (featuredError) {
      console.error("Error fetching featured tracks:", featuredError);
      return NextResponse.json(
        { error: "Failed to fetch featured tracks" },
        { status: 500 }
      );
    }
    
    // Get popular tracks (by play count)
    const { data: popularTracks, error: popularError } = await baseQuery()
      .order("play_count", { ascending: false })
      .limit(10);
    
    if (popularError) {
      console.error("Error fetching popular tracks:", popularError);
      return NextResponse.json(
        { error: "Failed to fetch featured tracks" },
        { status: 500 }
      );
    }
    
    // Get new releases (tracks created in the last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: newReleases, error: newError } = await baseQuery()
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(10);
    
    if (newError) {
      console.error("Error fetching new releases:", newError);
      return NextResponse.json(
        { error: "Failed to fetch featured tracks" },
        { status: 500 }
      );
    }
    
    // Format tracks for response
    const formatTracks = (tracks: any[]) => {
      if (!tracks) return [];
      
      return tracks.map(track => ({
        ...track,
        formatted_price: formatPrice(track.price_cents || 0),
        seller: {
          id: track.owner?.id || track.user_id,
          display_name: track.owner?.display_name || "Unknown Seller",
          avatar_url: track.owner?.avatar_url,
          // badge and rating will be added when seller verification is implemented
        },
      }));
    };
    
    const response = {
      featured: formatTracks(featuredTracks || []),
      popular: formatTracks(popularTracks || []),
      new_releases: formatTracks(newReleases || []),
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