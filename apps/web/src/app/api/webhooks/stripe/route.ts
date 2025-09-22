import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import Stripe from "stripe";
import { nanoid } from "nanoid";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
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
 * Handle guest to user conversion from checkout
 */
async function handleGuestConversion(
  session: Stripe.Checkout.Session,
  supabase: ReturnType<typeof createClient>
) {
  try {
    // Get customer email from Stripe session
    const customerEmail = session.customer_details?.email;
    if (!customerEmail) {
      console.error("No customer email in checkout session");
      return;
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", customerEmail)
      .single();

    let userId: string;

    if (existingUser) {
      // User already exists, use their ID
      userId = existingUser.id;
      console.log(`Existing user found for ${customerEmail}`);
    } else {
      // Create new user account
      // Generate a temporary password (user will need to reset)
      const tempPassword = nanoid(16);

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: customerEmail,
        password: tempPassword,
        email_confirm: true, // Auto-confirm email since they paid
        user_metadata: {
          full_name: session.customer_details?.name || "",
          preferred_name: session.custom_fields?.find(f => f.key === 'preferred_name')?.text?.value || "",
          source: "guest_conversion",
          first_purchase_date: new Date().toISOString(),
        },
      });

      if (authError || !authData.user) {
        console.error("Failed to create auth user:", authError);
        return;
      }

      userId = authData.user.id;

      // Create user profile
      await supabase.from("users").insert({
        id: userId,
        email: customerEmail,
        username: customerEmail.split('@')[0] + nanoid(6), // Generate unique username
        full_name: session.customer_details?.name || "",
        stripe_customer_id: session.customer as string,
        created_at: new Date().toISOString(),
      });

      console.log(`Created new user account for ${customerEmail}`);

      // TODO: Send welcome email with password reset link
    }

    // Reconstruct builder state from metadata
    const metadata = session.metadata || {};

    // Reconstruct script from chunks
    let script = "";
    const chunkCount = parseInt(metadata.script_chunks_count || "0");
    for (let i = 0; i < chunkCount; i++) {
      script += metadata[`script_chunk_${i}`] || "";
    }

    // Create audio job configuration
    const audioConfig = {
      script,
      voice: {
        provider: metadata.voice_provider,
        voice_id: metadata.voice_id,
        name: metadata.voice_name,
      },
      duration: parseInt(metadata.duration || "5"),
      backgroundMusic: metadata.background_music_id ? {
        id: metadata.background_music_id,
        name: metadata.background_music_name,
      } : undefined,
      solfeggio: metadata.solfeggio_frequency ? {
        enabled: true,
        frequency: parseInt(metadata.solfeggio_frequency),
      } : undefined,
      binaural: metadata.binaural_band ? {
        enabled: true,
        band: metadata.binaural_band,
      } : undefined,
    };

    // Create audio job record
    const { data: audioJob, error: jobError } = await supabase
      .from("audio_jobs")
      .insert({
        user_id: userId,
        status: "pending",
        config: audioConfig,
        title: `Track ${new Date().toLocaleDateString()}`,
        stripe_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent as string,
      })
      .select()
      .single();

    if (jobError || !audioJob) {
      console.error("Failed to create audio job:", jobError);
      return;
    }

    // Create purchase record for the first track
    await supabase.from("purchases").insert({
      buyer_id: userId,
      seller_id: userId, // Self-purchase for first track
      platform: "web",
      sale_price_cents: session.amount_total || 99,
      currency: session.currency?.toUpperCase() || "USD",
      status: "paid",
      stripe_payment_intent_id: session.payment_intent as string,
      stripe_checkout_session_id: session.id,
      metadata: {
        conversion_type: "guest_to_user",
        audio_job_id: audioJob.id,
      },
    });

    // Queue the audio job for processing
    // TODO: Trigger audio processing queue

    console.log(`Guest conversion completed for ${customerEmail}, audio job ${audioJob.id} created`);

  } catch (error) {
    console.error("Error handling guest conversion:", error);
  }
}

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events with idempotency
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

  const supabase = createClient();

  // Check for duplicate event (idempotency)
  const { data: existingEvent } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("event_id", event.id)
    .single();

  if (existingEvent) {
    console.log(`Duplicate webhook event ${event.id}, skipping`);
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Record the webhook event
  await supabase.from("webhook_events").insert({
    event_id: event.id,
    event_type: event.type,
    source: "stripe",
    payload: event,
  });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Check if this is a guest conversion
        if (session.metadata?.conversion_type === 'guest_to_user') {
          await handleGuestConversion(session, supabase);
          break;
        }

        // Extract metadata for regular purchases
        const userId = session.metadata?.userId;
        const trackId = session.metadata?.trackId;
        const sellerId = session.metadata?.sellerId;

        if (!userId || !trackId || !sellerId) {
          console.error("Missing required metadata in checkout session");
          break;
        }

        // Get seller's platform fee percentage
        const { data: sellerAgreement } = await supabase
          .from("seller_agreements")
          .select("platform_fee_percent")
          .eq("user_id", sellerId)
          .single();

        const platformFeePercent = sellerAgreement?.platform_fee_percent || 15;
        const amountCents = session.amount_total || 0;
        const processingFeeCents = calculateProcessingFees(amountCents);
        const platformFeeCents = Math.round(amountCents * (platformFeePercent / 100));
        const sellerEarningsCents = amountCents - processingFeeCents - platformFeeCents;

        // Create purchase record
        const { data: purchase, error: purchaseError } = await supabase
          .from("purchases")
          .insert({
            buyer_id: userId,
            track_id: trackId,
            seller_id: sellerId,
            platform: "web",
            sale_price_cents: amountCents,
            currency: session.currency?.toUpperCase() || "USD",
            status: "paid",
            stripe_payment_intent_id: session.payment_intent as string,
            stripe_checkout_session_id: session.id,
            seller_share_cents: sellerEarningsCents,
            platform_fee_cents: platformFeeCents,
            processor_fee_cents: processingFeeCents,
          })
          .select()
          .single();

        if (purchaseError) {
          console.error("Failed to create purchase:", purchaseError);
          break;
        }

        // Create earnings ledger entry
        await supabase.from("earnings_ledger").insert({
          seller_id: sellerId,
          purchase_id: purchase.id,
          track_id: trackId,
          gross_cents: amountCents,
          processor_fee_cents: processingFeeCents,
          platform_fee_cents: platformFeeCents,
          seller_earnings_cents: sellerEarningsCents,
          currency: session.currency?.toUpperCase() || "USD",
          channel: "web",
          payout_status: "pending",
        });

        // TODO: Grant access to purchased track
        // TODO: Send purchase confirmation email

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
        const { data: payout } = await supabase
          .from("payouts")
          .insert({
            seller_id: transfer.metadata?.sellerId,
            stripe_transfer_id: transfer.id,
            amount_cents: transfer.amount,
            currency: transfer.currency.toUpperCase(),
            status: "processing",
            period_start: transfer.metadata?.periodStart,
            period_end: transfer.metadata?.periodEnd,
            initiated_at: new Date().toISOString(),
          })
          .select()
          .single();

        // Update earnings ledger entries for this payout
        if (payout && transfer.metadata?.sellerId) {
          await supabase
            .from("earnings_ledger")
            .update({
              payout_id: payout.id,
              payout_status: "processing",
              payout_date: new Date().toISOString(),
            })
            .eq("seller_id", transfer.metadata.sellerId)
            .eq("payout_status", "pending")
            .gte("created_at", transfer.metadata.periodStart)
            .lte("created_at", transfer.metadata.periodEnd);
        }

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

        // Update earnings ledger
        const { data: payout } = await supabase
          .from("payouts")
          .select("id")
          .eq("stripe_transfer_id", transfer.id)
          .single();

        if (payout) {
          await supabase
            .from("earnings_ledger")
            .update({
              payout_status: "paid",
            })
            .eq("payout_id", payout.id);
        }

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

        // Reset earnings ledger entries
        const { data: payout } = await supabase
          .from("payouts")
          .select("id")
          .eq("stripe_transfer_id", transfer.id)
          .single();

        if (payout) {
          await supabase
            .from("earnings_ledger")
            .update({
              payout_id: null,
              payout_status: "pending",
              payout_date: null,
            })
            .eq("payout_id", payout.id);
        }

        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        
        // Update purchase status
        await supabase
          .from("purchases")
          .update({
            status: charge.refunded ? "refunded" : "partially_refunded",
            refunded_at: new Date().toISOString(),
            refund_amount: charge.amount_refunded,
          })
          .eq("stripe_payment_intent_id", charge.payment_intent);

        // TODO: Revoke access to purchased track
        // TODO: Adjust earnings ledger for refunds

        break;
      }

      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    // Return success to avoid Stripe retries for processing errors
    return NextResponse.json({ received: true, error: "Processing failed" });
  }
}