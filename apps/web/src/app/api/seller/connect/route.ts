import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";
import { z } from "zod";
import { 
  ConnectOnboardingResponseSchema,
  ConnectAccountStatusSchema 
} from "@mindscript/schemas";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

// Request schemas
const CreateConnectAccountSchema = z.object({
  returnUrl: z.string().url(),
  refreshUrl: z.string().url(),
  businessType: z.enum(["individual", "company"]).optional().default("individual"),
});

/**
 * POST /api/seller/connect
 * Create or retrieve Stripe Connect Express account and generate onboarding link
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = CreateConnectAccountSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { returnUrl, refreshUrl, businessType } = validationResult.data;

    // Check if seller agreement already exists
    const { data: existingAgreement } = await supabase
      .from("seller_agreements")
      .select("*")
      .eq("user_id", user.id)
      .single();

    let stripeAccountId: string;

    if (existingAgreement?.stripe_connect_account_id) {
      // Use existing Stripe account
      stripeAccountId = existingAgreement.stripe_connect_account_id;
    } else {
      // Get user profile for account creation
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, email")
        .eq("id", user.id)
        .single();

      // Create new Stripe Connect Express account
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email || profile?.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: businessType,
        business_profile: {
          name: profile?.display_name || undefined,
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

      stripeAccountId = account.id;

      // Get client IP for TOS acceptance
      const clientIp = request.headers.get("x-forwarded-for") || 
                      request.headers.get("x-real-ip") || 
                      "unknown";

      // Create or update seller agreement
      if (existingAgreement) {
        await supabase
          .from("seller_agreements")
          .update({
            stripe_connect_account_id: stripeAccountId,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("seller_agreements")
          .insert({
            user_id: user.id,
            stripe_connect_account_id: stripeAccountId,
            account_type: "express",
            status: "pending_onboarding",
            platform_fee_percent: 15,
            tos_accepted_ip: clientIp,
            tos_accepted_at: new Date().toISOString(),
          });
      }
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    const response = ConnectOnboardingResponseSchema.parse({
      accountId: stripeAccountId,
      onboardingUrl: accountLink.url,
      returnUrl,
      refreshUrl,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Connect account creation error:", error);
    return NextResponse.json(
      { 
        error: "Failed to create Connect account",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/seller/connect
 * Get Connect account status and requirements
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get seller agreement
    const { data: agreement, error: agreementError } = await supabase
      .from("seller_agreements")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (agreementError || !agreement) {
      return NextResponse.json(
        { error: "No seller agreement found" },
        { status: 404 }
      );
    }

    if (!agreement.stripe_connect_account_id) {
      return NextResponse.json(
        { error: "No Stripe account linked" },
        { status: 404 }
      );
    }

    // Retrieve account from Stripe
    const account = await stripe.accounts.retrieve(agreement.stripe_connect_account_id);

    // Update agreement if status has changed
    const needsUpdate = 
      agreement.charges_enabled !== account.charges_enabled ||
      agreement.payouts_enabled !== account.payouts_enabled ||
      agreement.details_submitted !== account.details_submitted;

    if (needsUpdate) {
      const newStatus = account.charges_enabled && account.payouts_enabled
        ? "active"
        : account.details_submitted
        ? "onboarding_incomplete"
        : "pending_onboarding";

      await supabase
        .from("seller_agreements")
        .update({
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          details_submitted: account.details_submitted,
          status: newStatus,
          onboarding_completed_at: 
            newStatus === "active" && !agreement.onboarding_completed_at
              ? new Date().toISOString()
              : agreement.onboarding_completed_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", agreement.id);
    }

    const response = ConnectAccountStatusSchema.parse({
      accountId: account.id,
      detailsSubmitted: account.details_submitted || false,
      chargesEnabled: account.charges_enabled || false,
      payoutsEnabled: account.payouts_enabled || false,
      requirementsCurrentlyDue: account.requirements?.currently_due || [],
      requirementsPastDue: account.requirements?.past_due || [],
      requirementsEventuallyDue: account.requirements?.eventually_due || [],
      requirementsDisabledReason: account.requirements?.disabled_reason || undefined,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Connect account status error:", error);
    return NextResponse.json(
      { 
        error: "Failed to retrieve account status",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}