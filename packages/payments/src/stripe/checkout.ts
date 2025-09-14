import Stripe from "stripe";
import { SupabaseClient } from "@supabase/supabase-js";
import { CartItem, calculatePlatformFee, calculateSellerEarnings } from "@mindscript/schemas";

export interface CheckoutConfig {
  stripe: Stripe;
  supabase: SupabaseClient;
  baseUrl: string;
}

export interface CreateCheckoutOptions {
  items: CartItem[];
  customerEmail?: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
  userId?: string | null;
}

/**
 * Validate cart items against database
 */
export async function validateCartItems(
  items: CartItem[],
  supabase: SupabaseClient
): Promise<{ valid: boolean; error?: string }> {
  const trackIds = items.map(item => item.trackId);
  
  // Fetch tracks from database
  const { data: tracks, error } = await supabase
    .from("tracks")
    .select("id, title, user_id, price_cents, is_public")
    .in("id", trackIds);

  if (error || !tracks) {
    return { valid: false, error: "Failed to validate tracks" };
  }

  // Verify all tracks exist and prices match
  for (const item of items) {
    const track = tracks.find(t => t.id === item.trackId);
    
    if (!track) {
      return { valid: false, error: `Track ${item.trackId} not found` };
    }

    if (track.price_cents !== item.price) {
      return { valid: false, error: `Price mismatch for track ${item.trackId}` };
    }

    if (track.user_id !== item.sellerId) {
      return { valid: false, error: `Seller mismatch for track ${item.trackId}` };
    }
  }

  return { valid: true };
}

/**
 * Validate seller Connect accounts
 */
export async function validateSellers(
  sellerIds: string[],
  supabase: SupabaseClient
): Promise<{ valid: boolean; error?: string; sellers?: any[] }> {
  const { data: sellers, error } = await supabase
    .from("seller_agreements")
    .select("user_id, stripe_connect_account_id, charges_enabled")
    .in("user_id", sellerIds);

  if (error || !sellers) {
    return { valid: false, error: "Failed to validate sellers" };
  }

  // Verify all sellers have Connect accounts
  for (const sellerId of sellerIds) {
    const seller = sellers.find(s => s.user_id === sellerId);
    
    if (!seller || !seller.stripe_connect_account_id) {
      return { valid: false, error: `Seller ${sellerId} not found or not onboarded` };
    }

    if (!seller.charges_enabled) {
      return { valid: false, error: `Seller ${sellerId} cannot accept charges` };
    }
  }

  return { valid: true, sellers };
}

/**
 * Create Stripe products and prices for cart items
 */
export async function createStripeLineItems(
  items: CartItem[],
  stripe: Stripe
): Promise<{
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
  metadata: Record<string, string>;
}> {
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const metadata: Record<string, string> = {};

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // Create product
    const product = await stripe.products.create({
      name: item.title,
      description: `Track: ${item.title} by ${item.artistName}`,
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

    // Store item metadata for webhook processing
    metadata[`item_${i}`] = JSON.stringify({
      trackId: item.trackId,
      sellerId: item.sellerId,
      sellerConnectAccountId: item.sellerConnectAccountId,
      price: item.price,
      platformFee: calculatePlatformFee(item.price, 15),
      sellerEarnings: calculateSellerEarnings(item.price, calculatePlatformFee(item.price, 15)),
    });
  }

  metadata.itemCount = items.length.toString();

  return { lineItems, metadata };
}

/**
 * Create a Stripe Checkout session
 */
export async function createCheckoutSession(
  options: CreateCheckoutOptions,
  config: CheckoutConfig
): Promise<Stripe.Checkout.Session> {
  const { stripe, supabase, baseUrl } = config;
  const { items, customerEmail, successUrl, cancelUrl, metadata = {}, userId } = options;

  // Validate items
  const itemValidation = await validateCartItems(items, supabase);
  if (!itemValidation.valid) {
    throw new Error(itemValidation.error);
  }

  // Validate sellers
  const sellerIds = [...new Set(items.map(item => item.sellerId))];
  const sellerValidation = await validateSellers(sellerIds, supabase);
  if (!sellerValidation.valid) {
    throw new Error(sellerValidation.error);
  }

  // Create line items and metadata
  const { lineItems, metadata: itemMetadata } = await createStripeLineItems(items, stripe);

  // Calculate totals
  const totalAmount = items.reduce((sum, item) => sum + item.price, 0);
  const totalPlatformFee = items.reduce((sum, item) => 
    sum + calculatePlatformFee(item.price, 15), 0
  );

  // Prepare session parameters
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: lineItems,
    success_url: successUrl || `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${baseUrl}/checkout/cancel`,
    customer_email: customerEmail,
    payment_method_types: ["card"],
    expires_at: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
    metadata: {
      ...itemMetadata,
      ...metadata,
      userId: userId || "guest",
      totalAmount: totalAmount.toString(),
      totalPlatformFee: totalPlatformFee.toString(),
    },
  };

  // Handle single vs multiple sellers
  if (sellerIds.length === 1) {
    // Single seller - use destination charges
    const seller = sellerValidation.sellers![0];
    sessionParams.payment_intent_data = {
      application_fee_amount: totalPlatformFee,
      transfer_data: {
        destination: seller.stripe_connect_account_id,
      },
      metadata: sessionParams.metadata,
    };
  } else {
    // Multiple sellers - handle transfers post-payment
    sessionParams.payment_intent_data = {
      metadata: {
        ...sessionParams.metadata,
        multiSeller: "true",
      },
    };
  }

  // Create and return the session
  return await stripe.checkout.sessions.create(sessionParams);
}

/**
 * Retrieve checkout session with expanded data
 */
export async function retrieveCheckoutSession(
  sessionId: string,
  stripe: Stripe,
  expand?: string[]
): Promise<Stripe.Checkout.Session> {
  return await stripe.checkout.sessions.retrieve(sessionId, {
    expand: expand || ["line_items", "payment_intent"],
  });
}

/**
 * Check if user has access to a track
 */
export async function checkTrackAccess(
  userId: string | null,
  sessionId: string,
  trackId: string,
  supabase: SupabaseClient
): Promise<boolean> {
  // Check if user owns the track
  if (userId) {
    const { data: track } = await supabase
      .from("tracks")
      .select("id")
      .eq("id", trackId)
      .eq("user_id", userId)
      .single();

    if (track) return true;

    // Check if user has purchased access
    const { data: access } = await supabase
      .from("track_access")
      .select("id")
      .eq("track_id", trackId)
      .eq("user_id", userId)
      .is("revoked_at", null)
      .single();

    if (access) return true;
  }

  // Check session-based access (guest checkout)
  const { data: sessionAccess } = await supabase
    .from("track_access")
    .select("id")
    .eq("track_id", trackId)
    .eq("session_id", sessionId)
    .is("revoked_at", null)
    .single();

  return !!sessionAccess;
}