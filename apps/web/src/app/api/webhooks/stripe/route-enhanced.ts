import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";
import { calculatePlatformFee, calculateSellerEarnings } from "@mindscript/schemas";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

// Stripe processing fee estimation (2.9% + 30¢)
const STRIPE_PERCENTAGE_FEE = 0.029;
const STRIPE_FIXED_FEE_CENTS = 30;

/**
 * Calculate processing fees for a given amount
 */
function calculateProcessingFees(amountCents: number): number {
  return Math.round(amountCents * STRIPE_PERCENTAGE_FEE + STRIPE_FIXED_FEE_CENTS);
}

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events with idempotency and comprehensive error handling
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Check for duplicate event (idempotency)
  const { data: existingEvent } = await supabase
    .from("webhook_events")
    .select("id, status")
    .eq("stripe_event_id", event.id)
    .single();

  if (existingEvent) {
    // If the event was already processed successfully, skip it
    if (existingEvent.status === "processed") {
      console.log(`Duplicate webhook event ${event.id}, already processed`);
      return NextResponse.json({ received: true, duplicate: true });
    }
    // If it failed before, we might want to retry
    console.log(`Retrying webhook event ${event.id}`);
  } else {
    // Record the new webhook event
    await supabase.from("webhook_events").insert({
      stripe_event_id: event.id,
      type: event.type,
      data: event,
      status: "processing",
    });
  }

  try {
    switch (event.type as string) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Extract metadata for all items
        const itemCount = parseInt(session.metadata?.itemCount || "0", 10);
        const userId = session.metadata?.userId === "guest" ? null : session.metadata?.userId;
        const sessionId = session.client_reference_id || `session_${session.id}`;

        // Create purchase record
        const { data: purchase, error: purchaseError } = await supabase
          .from("purchases")
          .insert({
            user_id: userId,
            session_id: sessionId,
            stripe_payment_intent_id: session.payment_intent as string,
            stripe_checkout_session_id: session.id,
            amount_total: session.amount_total || 0,
            currency: session.currency?.toUpperCase() || "USD",
            status: "processing",
            metadata: session.metadata,
          })
          .select()
          .single();

        if (purchaseError) {
          console.error("Failed to create purchase:", purchaseError);
          throw purchaseError;
        }

        // Process each item in the cart
        for (let i = 0; i < itemCount; i++) {
          const itemMetadata = session.metadata?.[`item_${i}`];
          if (!itemMetadata) continue;

          const item = JSON.parse(itemMetadata);
          
          // Create purchase item
          const { error: itemError } = await supabase
            .from("purchase_items")
            .insert({
              purchase_id: purchase.id,
              track_id: item.trackId,
              seller_id: item.sellerId,
              price: item.price,
              platform_fee: item.platformFee,
              seller_earnings: item.sellerEarnings,
            });

          if (itemError) {
            console.error(`Failed to create purchase item ${i}:`, itemError);
            throw itemError;
          }

          // Grant track access
          const { error: accessError } = await supabase
            .from("track_access")
            .insert({
              user_id: userId,
              session_id: sessionId,
              track_id: item.trackId,
              purchase_id: purchase.id,
              access_type: "purchase",
            });

          if (accessError) {
            console.error(`Failed to grant track access for item ${i}:`, accessError);
            throw accessError;
          }

          // Create earnings ledger entry
          const { error: ledgerError } = await supabase
            .from("earnings_ledger")
            .insert({
              purchase_id: purchase.id,
              seller_id: item.sellerId,
              track_id: item.trackId,
              gross_cents: item.price,
              platform_fee_cents: item.platformFee,
              processing_fee_cents: calculateProcessingFees(item.price),
              seller_cut_cents: item.sellerEarnings,
              status: "pending",
            });

          if (ledgerError) {
            console.error(`Failed to create earnings ledger for item ${i}:`, ledgerError);
            throw ledgerError;
          }
        }

        // Handle multi-seller transfers if needed
        if (session.metadata?.multiSeller === "true") {
          // Group items by seller for transfers
          const sellerTransfers: Record<string, number> = {};
          
          for (let i = 0; i < itemCount; i++) {
            const itemMetadata = session.metadata?.[`item_${i}`];
            if (!itemMetadata) continue;
            
            const item = JSON.parse(itemMetadata);
            if (!sellerTransfers[item.sellerConnectAccountId]) {
              sellerTransfers[item.sellerConnectAccountId] = 0;
            }
            sellerTransfers[item.sellerConnectAccountId] += item.sellerEarnings;
          }

          // Create transfers to each seller
          for (const [accountId, amount] of Object.entries(sellerTransfers)) {
            try {
              await stripe.transfers.create({
                amount,
                currency: "usd",
                destination: accountId,
                transfer_group: session.id,
                metadata: {
                  checkoutSessionId: session.id,
                  purchaseId: purchase.id,
                },
              });
            } catch (transferError) {
              console.error(`Failed to create transfer to ${accountId}:`, transferError);
              // Continue processing other transfers
            }
          }
        }

        // Update purchase status to succeeded
        await supabase
          .from("purchases")
          .update({
            status: "succeeded",
            completed_at: new Date().toISOString(),
          })
          .eq("id", purchase.id);

        break;
      }

      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Update purchase status
        await supabase
          .from("purchases")
          .update({
            status: "succeeded",
            completed_at: new Date().toISOString(),
          })
          .eq("stripe_checkout_session_id", session.id);

        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Update purchase status
        await supabase
          .from("purchases")
          .update({
            status: "failed",
          })
          .eq("stripe_checkout_session_id", session.id);

        // Revoke any granted access
        const { data: purchase } = await supabase
          .from("purchases")
          .select("id")
          .eq("stripe_checkout_session_id", session.id)
          .single();

        if (purchase) {
          await supabase
            .from("track_access")
            .update({
              revoked_at: new Date().toISOString(),
            })
            .eq("purchase_id", purchase.id);
        }

        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // Update purchase status if not already updated
        await supabase
          .from("purchases")
          .update({
            status: "succeeded",
            completed_at: new Date().toISOString(),
          })
          .eq("stripe_payment_intent_id", paymentIntent.id)
          .eq("status", "processing");

        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // Update purchase status
        await supabase
          .from("purchases")
          .update({
            status: "failed",
          })
          .eq("stripe_payment_intent_id", paymentIntent.id);

        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const refundAmount = charge.amount_refunded;
        const isFullRefund = charge.amount === charge.amount_refunded;
        
        // Update purchase status
        const { data: purchase } = await supabase
          .from("purchases")
          .update({
            status: isFullRefund ? "refunded" : "succeeded", // Keep as succeeded for partial refunds
            refunded_at: new Date().toISOString(),
            refund_amount: refundAmount,
          })
          .eq("stripe_payment_intent_id", charge.payment_intent)
          .select()
          .single();

        if (purchase) {
          // For full refunds, revoke access
          if (isFullRefund) {
            await supabase
              .from("track_access")
              .update({
                revoked_at: new Date().toISOString(),
              })
              .eq("purchase_id", purchase.id);

            // Update earnings ledger
            await supabase
              .from("earnings_ledger")
              .update({
                status: "refunded",
              })
              .eq("purchase_id", purchase.id);
          }
        }

        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        
        // Update seller agreement with latest Connect account status
        const status = account.charges_enabled && account.payouts_enabled
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
            status,
            onboarding_completed_at: 
              status === "active" ? new Date().toISOString() : undefined,
            business_name: account.business_profile?.name,
            country: account.country || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_connect_account_id", account.id);

        break;
      }

      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer;
        
        // Create payout record
        await supabase
          .from("payouts")
          .insert({
            seller_id: transfer.metadata?.sellerId,
            stripe_transfer_id: transfer.id,
            amount_cents: transfer.amount,
            currency: transfer.currency.toUpperCase(),
            status: "processing",
            initiated_at: new Date().toISOString(),
          });

        break;
      }

      case "transfer.paid": {
        const transfer = event.data.object as Stripe.Transfer;
        
        // Update payout status to completed
        await supabase
          .from("payouts")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("stripe_transfer_id", transfer.id);

        break;
      }

      case "transfer.failed": {
        const transfer = event.data.object as Stripe.Transfer;
        
        // Update payout status to failed
        await supabase
          .from("payouts")
          .update({
            status: "failed",
            failure_reason: "Transfer failed",
          })
          .eq("stripe_transfer_id", transfer.id);

        break;
      }

      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }

    // Mark webhook event as processed
    await supabase
      .from("webhook_events")
      .update({
        status: "processed",
      })
      .eq("stripe_event_id", event.id);

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error("Webhook processing error:", error);
    
    // Mark webhook event as failed
    await supabase
      .from("webhook_events")
      .update({
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        retry_count: existingEvent ? (existingEvent as any).retry_count + 1 : 1,
      })
      .eq("stripe_event_id", event.id);

    // Return success to avoid immediate Stripe retries
    // We'll handle retries based on our own logic
    return NextResponse.json({ 
      received: true, 
      error: "Processing failed - will retry" 
    });
  }
}