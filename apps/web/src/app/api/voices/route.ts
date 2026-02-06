/**
 * Voice Catalog API Route
 * Returns available voices for the voice picker
 * Public endpoint (no auth required for reading catalog)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  VoiceMetadataSchema,
  voiceRowToMetadata,
  type VoiceMetadata,
  type VoiceTier,
  type VoiceGender,
} from "@mindscript/schemas";

// Initialize Supabase client with user context (for auth check)
function getSupabaseClient(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: request.headers.get("Authorization") || "",
      },
    },
  });
}

/**
 * GET /api/voices
 * Returns voice catalog with tier information
 *
 * Query params:
 * - tier: Filter by tier (included, premium, custom)
 * - gender: Filter by gender (male, female, neutral)
 * - provider: Filter by provider (openai, elevenlabs)
 * - includeCustom: Include user's custom voices (requires auth)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient(request);
    const { searchParams } = new URL(request.url);

    // Parse query params
    const tierFilter = searchParams.get("tier") as VoiceTier | null;
    const genderFilter = searchParams.get("gender") as VoiceGender | null;
    const providerFilter = searchParams.get("provider") as "openai" | "elevenlabs" | null;
    const includeCustom = searchParams.get("includeCustom") === "true";

    // Check if user is authenticated (for custom voices)
    const { data: { user } } = await supabase.auth.getUser();
    const isAuthenticated = !!user;

    // Build query for catalog voices (included + premium)
    let catalogQuery = supabase
      .from("voice_catalog")
      .select("*")
      .eq("is_enabled", true)
      .in("tier", ["included", "premium"])
      .order("tier", { ascending: true })
      .order("sort_order", { ascending: true });

    // Apply filters
    if (tierFilter && tierFilter !== "custom") {
      catalogQuery = catalogQuery.eq("tier", tierFilter);
    }
    if (genderFilter) {
      catalogQuery = catalogQuery.eq("gender", genderFilter);
    }
    if (providerFilter) {
      catalogQuery = catalogQuery.eq("provider", providerFilter);
    }

    const { data: catalogVoices, error: catalogError } = await catalogQuery;

    if (catalogError) {
      console.error("Voice catalog fetch error:", catalogError);
      return NextResponse.json(
        { error: "Failed to fetch voices" },
        { status: 500 }
      );
    }

    // Transform to API format
    const voices: VoiceMetadata[] = (catalogVoices || []).map(voiceRowToMetadata);

    // If authenticated and includeCustom, fetch user's custom voices
    let customVoices: VoiceMetadata[] = [];
    if (isAuthenticated && includeCustom) {
      const { data: userCustomVoices, error: customError } = await supabase
        .from("voice_catalog")
        .select("*")
        .eq("tier", "custom")
        .eq("owner_user_id", user.id)
        .eq("is_enabled", true)
        .order("sort_order", { ascending: true });

      if (!customError && userCustomVoices) {
        customVoices = userCustomVoices.map(voiceRowToMetadata);
      }
    }

    // Group voices by tier for easier frontend consumption
    const voicesByTier = {
      included: voices.filter(v => v.tier === "included"),
      premium: voices.filter(v => v.tier === "premium"),
      custom: customVoices,
    };

    return NextResponse.json({
      success: true,
      voices: [...voices, ...customVoices],
      voicesByTier,
      meta: {
        totalCount: voices.length + customVoices.length,
        includedCount: voicesByTier.included.length,
        premiumCount: voicesByTier.premium.length,
        customCount: voicesByTier.custom.length,
        isAuthenticated,
      },
    });
  } catch (error) {
    console.error("Voice catalog error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
