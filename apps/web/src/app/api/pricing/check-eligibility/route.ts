import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { z } from "zod";

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

    if (user) {
      // Check if user exists in profiles and if they've used their discount
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("first_track_discount_used, created_at")
        .eq("id", user.id)
        .single();

      if (profileError) {
        // User doesn't have a profile yet (new user)
        userStatus = "new_user";
        isEligibleForDiscount = true;
      } else {
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

    // Use hardcoded pricing values for now (can be moved to DB later)
    const introPrice = 99; // $0.99 in cents
    const standardPrice = 299; // $2.99 in cents

    const basePrice = standardPrice;
    const discountedPrice = isEligibleForDiscount ? introPrice : standardPrice;
    const savings = basePrice - discountedPrice;

    const response = EligibilityResponseSchema.parse({
      isEligibleForDiscount,
      pricing: {
        basePrice,
        discountedPrice,
        savings,
        currency: "USD",
      },
      userStatus,
    });

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

    // Use hardcoded pricing values for now (can be moved to DB later)
    const introPrice = 99; // $0.99 in cents
    const standardPrice = 299; // $2.99 in cents

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