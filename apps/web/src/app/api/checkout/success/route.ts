import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import Stripe from "stripe";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items", "payment_intent"],
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Get Supabase client
    const supabase = createClient();

    // Get the purchase record
    const { data: purchase, error: purchaseError } = await supabase
      .from("purchases")
      .select(`
        *,
        tracks!track_id (
          id,
          title,
          description,
          audio_url
        )
      `)
      .eq("checkout_session_id", sessionId)
      .single();

    if (purchaseError || !purchase) {
      console.error("Error fetching purchase:", purchaseError);
      // Even if we can't find the purchase in our DB, return basic info from Stripe
    }

    // Check if this is a guest conversion
    const isGuestConversion = session.metadata?.conversion_type === 'guest_to_user';

    // For guest conversions, fetch the newly created track
    let trackId: string | undefined;
    if (isGuestConversion && session.metadata?.user_id) {
      const { data: track } = await supabase
        .from('tracks')
        .select('id')
        .eq('user_id', session.metadata.user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      trackId = track?.id;
    }

    // Prepare the response
    const items = purchase?.purchase_items?.map((item: any) => ({
      trackId: item.track_id,
      title: item.tracks?.title || "Track",
      downloadUrl: item.tracks?.audio_url ? `/api/tracks/${item.track_id}/download` : undefined,
    })) || [];

    // If we don't have purchase data, try to reconstruct from session metadata
    if (items.length === 0 && session.metadata) {
      const itemCount = parseInt(session.metadata.itemCount || "0", 10);
      for (let i = 0; i < itemCount; i++) {
        const itemData = session.metadata[`item_${i}`];
        if (itemData) {
          try {
            const item = JSON.parse(itemData);
            items.push({
              trackId: item.trackId,
              title: `Track ${i + 1}`, // We don't have the title in metadata
              downloadUrl: `/api/tracks/${item.trackId}/download`,
            });
          } catch (e) {
            console.error(`Failed to parse item ${i}:`, e);
          }
        }
      }
    }

    const response = {
      items,
      totalAmount: session.amount_total || 0,
      currency: session.currency?.toUpperCase() || "USD",
      receiptUrl: (session.payment_intent as Stripe.PaymentIntent)?.charges?.data?.[0]?.receipt_url,
      // Add redirect info for guest conversions
      ...(isGuestConversion && {
        redirectTo: `/library?new=true${trackId ? `&trackId=${trackId}` : ''}`,
        trackId,
      }),
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("Error fetching purchase details:", error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: `Stripe error: ${error.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch purchase details" },
      { status: 500 }
    );
  }
}