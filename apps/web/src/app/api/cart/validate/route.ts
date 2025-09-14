import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  CartValidationResponseSchema,
  type CartItem,
  type CartValidationResponse,
} from "@mindscript/schemas";
import { z } from "zod";

// POST /api/cart/validate - Validate cart items and prices
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items } = body as { items: CartItem[] };
    
    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "Invalid request: items array required" },
        { status: 400 }
      );
    }
    
    const supabase = await createClient();
    
    let totalAmount = 0;
    let validItemCount = 0;
    const errors: Array<{ trackId: string; error: string }> = [];
    
    // Validate each item
    for (const item of items) {
      // Fetch current track data
      const { data: track, error: trackError } = await supabase
        .from("tracks")
        .select(`
          id,
          title,
          price_cents,
          user_id,
          deleted_at,
          status,
          seller_agreements!tracks_user_id_fkey (
            stripe_connect_account_id,
            status,
            charges_enabled,
            payouts_enabled
          )
        `)
        .eq("id", item.trackId)
        .single();
      
      if (trackError || !track) {
        errors.push({
          trackId: item.trackId,
          error: "Track not found",
        });
        continue;
      }
      
      // Check if track is available
      if (track.deleted_at) {
        errors.push({
          trackId: item.trackId,
          error: "Track is no longer available",
        });
        continue;
      }
      
      // Check if track is published
      if (track.status !== "published") {
        errors.push({
          trackId: item.trackId,
          error: "Track is not published",
        });
        continue;
      }
      
      // Check seller status
      if (!track.seller_agreements) {
        errors.push({
          trackId: item.trackId,
          error: "Seller account not configured",
        });
        continue;
      }
      
      const sellerAgreement = track.seller_agreements;
      
      if (sellerAgreement.status !== "active") {
        errors.push({
          trackId: item.trackId,
          error: "Seller account is not active",
        });
        continue;
      }
      
      if (!sellerAgreement.charges_enabled || !sellerAgreement.payouts_enabled) {
        errors.push({
          trackId: item.trackId,
          error: "Seller cannot accept payments",
        });
        continue;
      }
      
      // Check if price matches
      if (track.price_cents !== item.price) {
        errors.push({
          trackId: item.trackId,
          error: `Price has changed from ${item.price} to ${track.price_cents}`,
        });
        // Don't continue - still count this as valid but with new price
      }
      
      // Add to total (use current price from database)
      totalAmount += track.price_cents;
      validItemCount++;
    }
    
    const response: CartValidationResponse = {
      valid: errors.length === 0 && validItemCount > 0,
      totalAmount,
      itemCount: validItemCount,
      errors: errors.length > 0 ? errors : undefined,
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("Cart validation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}