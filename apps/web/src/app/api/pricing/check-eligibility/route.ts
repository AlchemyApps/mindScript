import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { z } from "zod";
import { calculateAICost } from "../../../../lib/pricing/cost-calculator";
import type { FFTier } from "../../../../lib/pricing/ff-tier";
import { getPricingConfig } from "../../../../lib/pricing/pricing-service";

// Response schema
const EligibilityResponseSchema = z.object({
  isEligibleForDiscount: z.boolean(),
  pricing: z.object({
    basePrice: z.number(), // in cents
    discountedPrice: z.number(), // in cents
    savings: z.number(), // in cents
    currency: z.string().default("USD"),
  }),
  userStatus: z.enum(["anonymous", "new_user", "existing_eligible", "existing_ineligible"]),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated (optional)
    const { data: { user } } = await supabase.auth.getUser();

    let isEligibleForDiscount = true;
    let userStatus: "anonymous" | "new_user" | "existing_eligible" | "existing_ineligible" = "anonymous";
    let ffTier: FFTier = null;

    if (user) {
      // Check if user exists in profiles and if they've used their discount
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("first_track_discount_used, created_at, ff_tier")
        .eq("id", user.id)
        .single();

      if (profileError) {
        // User doesn't have a profile yet (new user)
        userStatus = "new_user";
        isEligibleForDiscount = true;
      } else {
        ffTier = (profile.ff_tier as FFTier) ?? null;

        // User exists, check if they've used their discount
        if (profile.first_track_discount_used) {
          userStatus = "existing_ineligible";
          isEligibleForDiscount = false;
        } else {
          userStatus = "existing_eligible";
          isEligibleForDiscount = true;
        }
      }
    }

    // Fetch all pricing from centralized service
    const pricingConfig = await getPricingConfig();

    const introPrice = pricingConfig.baseIntroCents;
    const standardPrice = pricingConfig.baseStandardCents;

    const basePrice = standardPrice;
    let discountedPrice = isEligibleForDiscount ? introPrice : standardPrice;
    let savings = basePrice - discountedPrice;

    // F&F tier overrides
    if (ffTier === 'inner_circle') {
      discountedPrice = 0;
      savings = basePrice;
    } else if (ffTier === 'cost_pass') {
      discountedPrice = 0;
      savings = basePrice;
    }

    const response = {
      isEligibleForDiscount: isEligibleForDiscount || ffTier !== null,
      pricing: {
        basePrice,
        discountedPrice,
        savings,
        currency: "USD",
      },
      userStatus,
      ffTier,
      // Extended pricing info for frontend
      addons: {
        solfeggioCents: pricingConfig.solfeggioCents,
        binauralCents: pricingConfig.binauralCents,
      },
      voicePricingTiers: pricingConfig.voicePricingTiers,
      voiceCloneFeeCents: pricingConfig.voiceCloneFeeCents,
      standardBgTrackCents: pricingConfig.standardBgTrackCents,
      isFirstPurchase: isEligibleForDiscount || ffTier !== null,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("Error in GET /api/pricing/check-eligibility:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid response data", details: error.errors },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST endpoint for when user signs in during checkout to re-check pricing
const CheckPricingRequestSchema = z.object({
  currentPrice: z.number(), // current price user sees in cents
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Require authentication for POST
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { currentPrice } = CheckPricingRequestSchema.parse(body);

    // Check user's actual eligibility
    const { data: isEligible, error: eligibilityError } = await supabase
      .rpc("is_eligible_for_first_track_discount", { user_id: user.id });

    if (eligibilityError) {
      console.error("Error checking eligibility:", eligibilityError);
      return NextResponse.json(
        { error: "Failed to check eligibility" },
        { status: 500 }
      );
    }

    // Fetch pricing from centralized service
    const pricingConfigPost = await getPricingConfig();
    const introPrice = pricingConfigPost.baseIntroCents;
    const standardPrice = pricingConfigPost.baseStandardCents;

    const correctPrice = isEligible ? introPrice : standardPrice;
    const priceChanged = currentPrice !== correctPrice;

    const response = {
      priceChanged,
      currentPrice,
      correctPrice,
      isEligible,
      savings: standardPrice - correctPrice,
      message: priceChanged
        ? isEligible
          ? "Great news! You're eligible for our first-track discount."
          : "Since you've already used your first-track discount, the regular price applies."
        : "Pricing confirmed.",
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("Error in POST /api/pricing/check-eligibility:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}