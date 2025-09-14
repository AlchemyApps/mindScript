import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  CartItemSchema,
  AddToCartRequestSchema,
  RemoveFromCartRequestSchema,
  CartValidationResponseSchema,
  type CartItem,
} from "@mindscript/schemas";
import { z } from "zod";
import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";

// Get or create session ID for guest tracking
function getSessionId(request: NextRequest): string {
  const cookieStore = cookies();
  let sessionId = cookieStore.get("cart_session_id")?.value;
  
  if (!sessionId) {
    sessionId = uuidv4();
    // Session ID will be set in response headers
  }
  
  return sessionId;
}

// GET /api/cart - Get current cart items
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const sessionId = getSessionId(request);
    
    // Get user if authenticated
    const { data: { user } } = await supabase.auth.getUser();
    
    // Build query
    let query = supabase
      .from("cart_items")
      .select(`
        id,
        track_id,
        quantity,
        added_at,
        tracks (
          id,
          title,
          price_cents,
          user_id,
          profiles!tracks_user_id_fkey (
            display_name
          ),
          seller_agreements!tracks_user_id_fkey (
            stripe_connect_account_id
          )
        )
      `);
    
    // Filter by user or session
    if (user) {
      query = query.eq("user_id", user.id);
    } else {
      query = query.eq("session_id", sessionId).is("user_id", null);
    }
    
    const { data: cartItems, error } = await query;
    
    if (error) {
      console.error("Error fetching cart items:", error);
      return NextResponse.json(
        { error: "Failed to fetch cart items" },
        { status: 500 }
      );
    }
    
    // Transform to cart item format
    const items: CartItem[] = (cartItems || []).map(item => ({
      trackId: item.track_id,
      title: item.tracks?.title || "",
      artistName: item.tracks?.profiles?.display_name || "Unknown Artist",
      artistId: item.tracks?.user_id || "",
      price: item.tracks?.price_cents || 0,
      sellerId: item.tracks?.user_id || "",
      sellerConnectAccountId: item.tracks?.seller_agreements?.stripe_connect_account_id || "",
      quantity: item.quantity,
      addedAt: new Date(item.added_at),
    }));
    
    const response = NextResponse.json({ items });
    
    // Set session cookie for guests
    if (!user && !cookies().get("cart_session_id")) {
      response.cookies.set("cart_session_id", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    }
    
    return response;
  } catch (error) {
    console.error("Cart GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/cart - Add item to cart
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = AddToCartRequestSchema.parse(body);
    
    const supabase = await createClient();
    const sessionId = getSessionId(request);
    
    // Get user if authenticated
    const { data: { user } } = await supabase.auth.getUser();
    
    // Check if item already exists in cart
    let existingQuery = supabase
      .from("cart_items")
      .select("id")
      .eq("track_id", validatedData.trackId);
    
    if (user) {
      existingQuery = existingQuery.eq("user_id", user.id);
    } else {
      existingQuery = existingQuery.eq("session_id", sessionId).is("user_id", null);
    }
    
    const { data: existing } = await existingQuery.single();
    
    if (existing) {
      return NextResponse.json(
        { error: "Item already in cart" },
        { status: 400 }
      );
    }
    
    // Check cart size limit (10 items)
    let countQuery = supabase
      .from("cart_items")
      .select("id", { count: "exact", head: true });
    
    if (user) {
      countQuery = countQuery.eq("user_id", user.id);
    } else {
      countQuery = countQuery.eq("session_id", sessionId).is("user_id", null);
    }
    
    const { count } = await countQuery;
    
    if (count && count >= 10) {
      return NextResponse.json(
        { error: "Cart is full (maximum 10 items)" },
        { status: 400 }
      );
    }
    
    // Add item to cart
    const { data: newItem, error } = await supabase
      .from("cart_items")
      .insert({
        user_id: user?.id || null,
        session_id: sessionId,
        track_id: validatedData.trackId,
        quantity: 1,
      })
      .select()
      .single();
    
    if (error) {
      console.error("Error adding to cart:", error);
      return NextResponse.json(
        { error: "Failed to add item to cart" },
        { status: 500 }
      );
    }
    
    const response = NextResponse.json({ 
      success: true,
      item: newItem 
    });
    
    // Set session cookie for guests
    if (!user && !cookies().get("cart_session_id")) {
      response.cookies.set("cart_session_id", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    }
    
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }
    
    console.error("Cart POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/cart - Remove item from cart
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get("trackId");
    
    if (!trackId) {
      return NextResponse.json(
        { error: "Track ID is required" },
        { status: 400 }
      );
    }
    
    const supabase = await createClient();
    const sessionId = getSessionId(request);
    
    // Get user if authenticated
    const { data: { user } } = await supabase.auth.getUser();
    
    // Delete item from cart
    let deleteQuery = supabase
      .from("cart_items")
      .delete()
      .eq("track_id", trackId);
    
    if (user) {
      deleteQuery = deleteQuery.eq("user_id", user.id);
    } else {
      deleteQuery = deleteQuery.eq("session_id", sessionId).is("user_id", null);
    }
    
    const { error } = await deleteQuery;
    
    if (error) {
      console.error("Error removing from cart:", error);
      return NextResponse.json(
        { error: "Failed to remove item from cart" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cart DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}