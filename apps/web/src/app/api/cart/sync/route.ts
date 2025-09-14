import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  SyncCartRequestSchema,
  CartSyncResponseSchema,
  type CartItem,
  type CartSyncResponse,
} from "@mindscript/schemas";
import { z } from "zod";
import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";

// POST /api/cart/sync - Sync cart with server
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = SyncCartRequestSchema.parse(body);
    
    const supabase = await createClient();
    
    // Get or create session ID
    const cookieStore = cookies();
    let sessionId = validatedData.sessionId || cookieStore.get("cart_session_id")?.value;
    
    if (!sessionId) {
      sessionId = uuidv4();
    }
    
    // Get user if authenticated
    const { data: { user } } = await supabase.auth.getUser();
    
    // Get current server cart items
    let serverQuery = supabase
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
          deleted_at,
          profiles!tracks_user_id_fkey (
            display_name
          ),
          seller_agreements!tracks_user_id_fkey (
            stripe_connect_account_id,
            status
          )
        )
      `);
    
    if (user) {
      serverQuery = serverQuery.eq("user_id", user.id);
    } else {
      serverQuery = serverQuery.eq("session_id", sessionId).is("user_id", null);
    }
    
    const { data: serverItems, error: fetchError } = await serverQuery;
    
    if (fetchError) {
      console.error("Error fetching server cart:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch server cart" },
        { status: 500 }
      );
    }
    
    // Build map of existing server items by track ID
    const serverItemMap = new Map<string, any>();
    (serverItems || []).forEach(item => {
      if (item.tracks && !item.tracks.deleted_at) {
        serverItemMap.set(item.track_id, item);
      }
    });
    
    // Process client items
    const validItems: CartItem[] = [];
    const validationErrors: Array<{ trackId: string; reason: string }> = [];
    let mergedCount = 0;
    let removedCount = 0;
    
    for (const clientItem of validatedData.items) {
      // Check if track exists and is available
      const { data: track, error: trackError } = await supabase
        .from("tracks")
        .select(`
          id,
          title,
          price_cents,
          user_id,
          deleted_at,
          status,
          profiles!tracks_user_id_fkey (
            display_name
          ),
          seller_agreements!tracks_user_id_fkey (
            stripe_connect_account_id,
            status
          )
        `)
        .eq("id", clientItem.trackId)
        .single();
      
      if (trackError || !track || track.deleted_at) {
        validationErrors.push({
          trackId: clientItem.trackId,
          reason: "unavailable",
        });
        removedCount++;
        continue;
      }
      
      // Check if seller is active
      if (!track.seller_agreements?.stripe_connect_account_id || 
          track.seller_agreements?.status !== "active") {
        validationErrors.push({
          trackId: clientItem.trackId,
          reason: "seller_inactive",
        });
        removedCount++;
        continue;
      }
      
      // Check if price has changed
      if (track.price_cents !== clientItem.price) {
        validationErrors.push({
          trackId: clientItem.trackId,
          reason: "price_changed",
        });
        // Still add the item but with updated price
      }
      
      // Add to valid items with current data
      validItems.push({
        trackId: track.id,
        title: track.title,
        artistName: track.profiles?.display_name || "Unknown Artist",
        artistId: track.user_id,
        price: track.price_cents,
        sellerId: track.user_id,
        sellerConnectAccountId: track.seller_agreements.stripe_connect_account_id,
        quantity: 1,
        addedAt: clientItem.addedAt,
      });
      
      // Check if this is a new item not in server cart
      if (!serverItemMap.has(track.id)) {
        mergedCount++;
      }
    }
    
    // Clear existing cart items
    let clearQuery = supabase.from("cart_items").delete();
    
    if (user) {
      clearQuery = clearQuery.eq("user_id", user.id);
    } else {
      clearQuery = clearQuery.eq("session_id", sessionId).is("user_id", null);
    }
    
    await clearQuery;
    
    // Insert valid items (limit to 10)
    const itemsToInsert = validItems.slice(0, 10).map(item => ({
      user_id: user?.id || null,
      session_id: sessionId,
      track_id: item.trackId,
      quantity: 1,
    }));
    
    if (itemsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("cart_items")
        .insert(itemsToInsert);
      
      if (insertError) {
        console.error("Error inserting cart items:", insertError);
        return NextResponse.json(
          { error: "Failed to sync cart items" },
          { status: 500 }
        );
      }
    }
    
    const syncResponse: CartSyncResponse = {
      items: validItems.slice(0, 10),
      mergedCount,
      removedCount,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    };
    
    const response = NextResponse.json(syncResponse);
    
    // Set session cookie
    response.cookies.set("cart_session_id", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }
    
    console.error("Cart sync error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}