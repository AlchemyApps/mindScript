import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import Stripe from "stripe";
import {
  CreateCheckoutSessionRequestSchema,
  CheckoutSessionResponseSchema,
  calculatePlatformFee,
  calculateSellerEarnings,
} from "@mindscript/schemas";
import { z } from "zod";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = CreateCheckoutSessionRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { items, successUrl, cancelUrl, customerEmail, metadata } = validationResult.data;

    // Get Supabase client
    const supabase = createClient();

    // Get current user (optional - support guest checkout)
    const { data: { user } } = await supabase.auth.getUser();

    // Validate all tracks exist and prices match
    const trackIds = items.map(item => item.trackId);
    const { data: tracks, error: tracksError } = await supabase
      .from("tracks")
      .select("id, title, user_id, price_cents, is_public")
      .in("id", trackIds);

    if (tracksError || !tracks) {
      console.error("Error fetching tracks:", tracksError);
      return NextResponse.json(
        { error: "Failed to validate tracks" },
        { status: 500 }
      );
    }

    // Verify all tracks were found and validate prices
    for (const item of items) {
      const track = tracks.find(t => t.id === item.trackId);
      
      if (!track) {
        return NextResponse.json(
          { error: `Track ${item.trackId} not found` },
          { status: 404 }
        );
      }

      if (track.price_cents !== item.price) {
        return NextResponse.json(
          { error: `Price mismatch for track ${item.trackId}` },
          { status: 400 }
        );
      }

      if (track.user_id !== item.sellerId) {
        return NextResponse.json(
          { error: `Seller mismatch for track ${item.trackId}` },
          { status: 400 }
        );
      }
    }

    // Get seller Connect account IDs
    const sellerIds = [...new Set(items.map(item => item.sellerId))];
    const { data: sellerAgreements, error: sellersError } = await supabase
      .from("seller_agreements")
      .select("user_id, stripe_connect_account_id, charges_enabled")
      .in("user_id", sellerIds);

    if (sellersError || !sellerAgreements) {
      console.error("Error fetching seller agreements:", sellersError);
      return NextResponse.json(
        { error: "Failed to validate sellers" },
        { status: 500 }
      );
    }

    // Verify all sellers have Connect accounts
    for (const sellerId of sellerIds) {
      const agreement = sellerAgreements.find(s => s.user_id === sellerId);
      
      if (!agreement || !agreement.stripe_connect_account_id) {
        return NextResponse.json(
          { error: `Seller ${sellerId} not found or not onboarded` },
          { status: 400 }
        );
      }

      if (!agreement.charges_enabled) {
        return NextResponse.json(
          { error: `Seller ${sellerId} cannot accept charges` },
          { status: 400 }
        );
      }
    }

    // Create Stripe products and prices for each item
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    const itemMetadata: Record<string, any> = {};

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Create product
      const product = await stripe.products.create({
        name: item.title,
        description: item.description,
        metadata: {
          trackId: item.trackId,
          sellerId: item.sellerId,
        },
      });

      // Create price
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: item.price,
        currency: "usd",
      });

      lineItems.push({
        price: price.id,
        quantity: 1,
      });

      // Store metadata for webhook processing
      itemMetadata[`item_${i}`] = JSON.stringify({
        trackId: item.trackId,
        sellerId: item.sellerId,
        sellerConnectAccountId: item.sellerConnectAccountId,
        price: item.price,
        platformFee: calculatePlatformFee(item.price, 15),
        sellerEarnings: calculateSellerEarnings(item.price, calculatePlatformFee(item.price, 15)),
      });
    }

    // Calculate total amount and fees
    const totalAmount = items.reduce((sum, item) => sum + item.price, 0);
    const totalPlatformFee = items.reduce((sum, item) => 
      sum + calculatePlatformFee(item.price, 15), 0
    );

    // Determine success and cancel URLs
    const baseUrl = `https://${request.headers.get("host") || "localhost:3000"}`;
    const finalSuccessUrl = successUrl || `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const finalCancelUrl = cancelUrl || `${baseUrl}/checkout/cancel`;

    // Create checkout session parameters
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      line_items: lineItems,
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      customer_email: customerEmail,
      metadata: {
        ...itemMetadata,
        userId: user?.id || "guest",
        itemCount: items.length.toString(),
        totalAmount: totalAmount.toString(),
        totalPlatformFee: totalPlatformFee.toString(),
        ...metadata,
      },
      payment_method_types: ["card"],
      expires_at: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
    };

    // For single seller, use destination charges
    // For multiple sellers, we'll need to handle splits differently
    if (sellerIds.length === 1) {
      const sellerAgreement = sellerAgreements[0];
      
      sessionParams.payment_intent_data = {
        application_fee_amount: totalPlatformFee,
        transfer_data: {
          destination: sellerAgreement.stripe_connect_account_id!,
        },
        metadata: {
          ...itemMetadata,
          userId: user?.id || "guest",
        },
      };
    } else {
      // For multiple sellers, we'll process transfers after payment
      // Store the split information in metadata
      sessionParams.payment_intent_data = {
        metadata: {
          ...itemMetadata,
          userId: user?.id || "guest",
          multiSeller: "true",
        },
      };
    }

    // Create the checkout session
    const session = await stripe.checkout.sessions.create(sessionParams);

    // Return the session details
    const response = CheckoutSessionResponseSchema.parse({
      sessionId: session.id,
      url: session.url!,
      expiresAt: new Date(session.expires_at * 1000).toISOString(),
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error("Error creating checkout session:", error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: `Stripe error: ${error.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}