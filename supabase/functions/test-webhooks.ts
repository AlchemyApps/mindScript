#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Test webhook Edge Functions locally
 * Usage: deno run --allow-net --allow-env --allow-read test-webhooks.ts [stripe|revenuecat|resend]
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Webhook } from "https://esm.sh/svix@1.4.0";
import Stripe from "https://esm.sh/stripe@14.5.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "http://localhost:54321";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "whsec_test";
const RESEND_WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET") || "whsec_test";
const REVENUECAT_AUTH_TOKEN = Deno.env.get("REVENUECAT_WEBHOOK_AUTH_TOKEN") || "test_token";

const webhookType = Deno.args[0] || "all";

// Test payloads
const stripePayload = {
  id: "evt_test_" + Date.now(),
  object: "event",
  api_version: "2023-10-16",
  created: Math.floor(Date.now() / 1000),
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_" + Date.now(),
      object: "checkout.session",
      amount_total: 999,
      currency: "usd",
      customer: "cus_test123",
      metadata: {
        userId: "user_123",
        trackId: "track_456",
        sellerId: "seller_789",
      },
      mode: "payment",
      payment_intent: "pi_test_" + Date.now(),
      payment_status: "paid",
      status: "complete",
      success_url: "https://example.com/success",
    },
  },
};

const revenueCatPayload = {
  api_version: "1.0",
  event: {
    id: "evt_rc_" + Date.now(),
    type: "INITIAL_PURCHASE",
    occurred_at: Math.floor(Date.now() / 1000),
    app_user_id: "user_123",
    original_app_user_id: "user_123",
    aliases: ["user_123"],
    product_id: "com.mindscript.track_bundle_5",
    period_type: "NORMAL",
    purchased_at_ms: Date.now(),
    expiration_at_ms: null,
    environment: "PRODUCTION",
    entitlement_ids: ["track_bundle_5"],
    presented_offering_id: "default",
    transaction_id: "1000000123456789",
    original_transaction_id: "1000000123456789",
    is_family_share: false,
    country_code: "US",
    app_id: "app_abc123",
    aliases: [],
    currency: "USD",
    price: 9.99,
    price_in_purchased_currency: 9.99,
    subscriber_attributes: {
      "$email": {
        value: "user@example.com",
        updated_at_ms: Date.now(),
      },
    },
  },
};

const resendPayload = {
  id: "evt_resend_" + Date.now(),
  type: "email.delivered",
  created_at: new Date().toISOString(),
  data: {
    email_id: "email_" + Date.now(),
    from: "noreply@mindscript.app",
    to: ["user@example.com"],
    subject: "Your track is ready!",
    created_at: new Date().toISOString(),
    delivered_at: new Date().toISOString(),
    last_event: "delivered",
    html: "<p>Your track has been rendered successfully!</p>",
    text: "Your track has been rendered successfully!",
    bcc: null,
    cc: null,
    reply_to: null,
    tags: {
      track_id: "track_456",
      user_id: "user_123",
    },
  },
};

async function testWebhook(
  name: string,
  url: string,
  payload: any,
  headers: Record<string, string>
): Promise<void> {
  console.log(`\n🧪 Testing ${name} webhook...`);
  console.log(`URL: ${url}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(payload),
    });

    const body = await response.text();
    let jsonBody;
    try {
      jsonBody = JSON.parse(body);
    } catch {
      jsonBody = body;
    }

    if (response.ok) {
      console.log(`✅ ${name} webhook test passed (${response.status})`);
      console.log("Response:", jsonBody);
    } else {
      console.error(`❌ ${name} webhook test failed (${response.status})`);
      console.error("Response:", jsonBody);
    }
  } catch (error) {
    console.error(`❌ ${name} webhook test error:`, error);
  }
}

async function generateStripeSignature(payload: any, secret: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadString = JSON.stringify(payload);
  const signedPayload = `${timestamp}.${payloadString}`;

  // For testing, we'll use a mock signature
  // In production, Stripe CLI or actual Stripe service generates this
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret.replace("whsec_", "")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedPayload)
  );

  const hexSignature = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return `t=${timestamp},v1=${hexSignature}`;
}

async function generateResendSignature(payload: any, secret: string): Promise<string> {
  // Resend uses Svix, similar to how we handle it in the webhook
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const msgId = "msg_" + Date.now();
  const payloadString = JSON.stringify(payload);

  const encoder = new TextEncoder();
  const toSign = encoder.encode(`${msgId}.${timestamp}.${payloadString}`);
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret.replace("whsec_", "")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, toSign);
  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return `${msgId} ${timestamp} ${base64Signature}`;
}

async function runTests() {
  console.log("🚀 Starting webhook Edge Function tests...\n");
  console.log(`Environment: ${SUPABASE_URL}`);
  console.log(`Testing: ${webhookType === "all" ? "All webhooks" : webhookType}`);

  const baseUrl = `${SUPABASE_URL}/functions/v1`;

  if (webhookType === "stripe" || webhookType === "all") {
    const stripeSignature = await generateStripeSignature(stripePayload, STRIPE_WEBHOOK_SECRET);
    await testWebhook(
      "Stripe",
      `${baseUrl}/stripe-webhook`,
      stripePayload,
      {
        "stripe-signature": stripeSignature,
      }
    );
  }

  if (webhookType === "revenuecat" || webhookType === "all") {
    await testWebhook(
      "RevenueCat",
      `${baseUrl}/revenuecat-webhook`,
      revenueCatPayload,
      {
        "Authorization": `Bearer ${REVENUECAT_AUTH_TOKEN}`,
      }
    );
  }

  if (webhookType === "resend" || webhookType === "all") {
    const resendSignature = await generateResendSignature(resendPayload, RESEND_WEBHOOK_SECRET);
    await testWebhook(
      "Resend",
      `${baseUrl}/resend-webhook`,
      resendPayload,
      {
        "webhook-signature": resendSignature,
      }
    );
  }

  console.log("\n✨ All tests completed!");

  // Check webhook_events table
  if (SUPABASE_ANON_KEY) {
    console.log("\n📊 Checking webhook_events table...");
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data, error } = await supabase
      .from("webhook_events")
      .select("event_id, source, event_type, status, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Error fetching webhook events:", error);
    } else {
      console.log("Recent webhook events:", data);
    }
  }
}

// Run tests
if (import.meta.main) {
  runTests().catch(console.error);
}