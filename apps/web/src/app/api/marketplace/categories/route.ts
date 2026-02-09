import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { 
  getCategoryLabel, 
  getCategoryIcon,
  type MarketplaceCategory,
  type CategoryWithCount,
} from "@mindscript/schemas";

const CATEGORIES: MarketplaceCategory[] = [
  "meditation",
  "sleep",
  "focus",
  "relaxation",
  "energy",
  "healing",
];

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get counts for each category
    const { data: tracks, error } = await supabase
      .from("tracks")
      .select("category")
      .eq("status", "published")
      .is("deleted_at", null);
    
    if (error) {
      console.error("Error fetching categories:", error);
      return NextResponse.json(
        { error: "Failed to fetch categories" },
        { status: 500 }
      );
    }
    
    // Count tracks per category
    const categoryCounts = tracks?.reduce((acc, track) => {
      const cat = track.category as MarketplaceCategory;
      if (CATEGORIES.includes(cat)) {
        acc[cat] = (acc[cat] || 0) + 1;
      }
      return acc;
    }, {} as Record<MarketplaceCategory, number>) || {};
    
    // Build category list with counts
    const categories: CategoryWithCount[] = CATEGORIES.map(category => ({
      name: category,
      label: getCategoryLabel(category),
      count: categoryCounts[category] || 0,
      icon: getCategoryIcon(category),
    }));
    
    // Sort by count (descending) then by label (ascending)
    categories.sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.label.localeCompare(b.label);
    });
    
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}