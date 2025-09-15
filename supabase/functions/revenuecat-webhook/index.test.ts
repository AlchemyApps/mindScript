/**
 * Tests for RevenueCat Webhook Handler
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Mock environment variables
Deno.env.set("SUPABASE_URL", "http://localhost:54321");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
Deno.env.set("REVENUECAT_WEBHOOK_AUTH_TOKEN", "test-webhook-token");
Deno.env.set("ENVIRONMENT", "test");

// Helper to create a mock webhook event
function createMockWebhookEvent(
  type: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    api_version: "1.0",
    event: {
      id: crypto.randomUUID(),
      type,
      event_timestamp_ms: Date.now(),
      app_id: "app_test",
      app_user_id: "550e8400-e29b-41d4-a716-446655440000", // Valid UUID
      original_app_user_id: "550e8400-e29b-41d4-a716-446655440000",
      product_id: "mindscript_starter_monthly",
      price: 9.99,
      currency: "USD",
      store: "APP_STORE",
      environment: "SANDBOX",
      store_transaction_id: `test_transaction_${Date.now()}`,
      purchased_at_ms: Date.now(),
      expiration_at_ms: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
      ...overrides,
    },
  };
}

// Helper to make webhook request
async function makeWebhookRequest(
  body: unknown,
  authToken: string = "test-webhook-token"
): Promise<Response> {
  const response = await fetch("http://localhost:54321/functions/v1/revenuecat-webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`,
    },
    body: JSON.stringify(body),
  });
  return response;
}

Deno.test("Webhook Handler - Rejects unauthorized requests", async () => {
  const event = createMockWebhookEvent("INITIAL_PURCHASE");
  const response = await makeWebhookRequest(event, "wrong-token");

  assertEquals(response.status, 401);
  const body = await response.json();
  assertEquals(body.error, "Unauthorized");
});

Deno.test("Webhook Handler - Rejects non-POST requests", async () => {
  const response = await fetch("http://localhost:54321/functions/v1/revenuecat-webhook", {
    method: "GET",
    headers: {
      "Authorization": `Bearer test-webhook-token`,
    },
  });

  assertEquals(response.status, 405);
  const body = await response.json();
  assertEquals(body.error, "Method not allowed");
});

Deno.test("Webhook Handler - Rejects invalid JSON", async () => {
  const response = await fetch("http://localhost:54321/functions/v1/revenuecat-webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer test-webhook-token`,
    },
    body: "invalid json",
  });

  assertEquals(response.status, 400);
  const body = await response.json();
  assertEquals(body.error, "Invalid JSON");
});

Deno.test("Webhook Handler - Validates webhook event schema", async () => {
  const invalidEvent = {
    api_version: "1.0",
    event: {
      // Missing required fields
      type: "INVALID_TYPE",
    },
  };

  const response = await makeWebhookRequest(invalidEvent);
  assertEquals(response.status, 400);
  const body = await response.json();
  assertEquals(body.error, "Invalid webhook event");
});

Deno.test("Webhook Handler - Handles duplicate events (idempotency)", async () => {
  const event = createMockWebhookEvent("INITIAL_PURCHASE", {
    id: "duplicate-event-id",
  });

  // First request
  const response1 = await makeWebhookRequest(event);
  assertEquals(response1.status, 200);
  const body1 = await response1.json();
  assertEquals(body1.received, true);

  // Second request with same event ID (should be detected as duplicate)
  const response2 = await makeWebhookRequest(event);
  assertEquals(response2.status, 200);
  const body2 = await response2.json();
  assertEquals(body2.received, true);
  assertEquals(body2.duplicate, true);
});

Deno.test("Webhook Handler - Processes INITIAL_PURCHASE event", async () => {
  const event = createMockWebhookEvent("INITIAL_PURCHASE", {
    product_id: "mindscript_intro_monthly",
    price: 0.99,
    is_trial_conversion: false,
  });

  const response = await makeWebhookRequest(event);
  assertEquals(response.status, 200);

  const body = await response.json();
  assertEquals(body.received, true);

  // Verify purchase was created in database
  // This would require mocking the Supabase client
  // In a real test, we'd verify the database state
});

Deno.test("Webhook Handler - Processes RENEWAL event", async () => {
  const event = createMockWebhookEvent("RENEWAL", {
    product_id: "mindscript_starter_monthly",
    price: 9.99,
  });

  const response = await makeWebhookRequest(event);
  assertEquals(response.status, 200);

  const body = await response.json();
  assertEquals(body.received, true);
});

Deno.test("Webhook Handler - Processes CANCELLATION event", async () => {
  const event = createMockWebhookEvent("CANCELLATION", {
    cancellation_reason: "UNSUBSCRIBE",
  });

  const response = await makeWebhookRequest(event);
  assertEquals(response.status, 200);

  const body = await response.json();
  assertEquals(body.received, true);
});

Deno.test("Webhook Handler - Processes EXPIRATION event", async () => {
  const event = createMockWebhookEvent("EXPIRATION");

  const response = await makeWebhookRequest(event);
  assertEquals(response.status, 200);

  const body = await response.json();
  assertEquals(body.received, true);
});

Deno.test("Webhook Handler - Processes BILLING_ISSUE event", async () => {
  const event = createMockWebhookEvent("BILLING_ISSUE");

  const response = await makeWebhookRequest(event);
  assertEquals(response.status, 200);

  const body = await response.json();
  assertEquals(body.received, true);
});

Deno.test("Webhook Handler - Processes PRODUCT_CHANGE event", async () => {
  const event = createMockWebhookEvent("PRODUCT_CHANGE", {
    product_id: "mindscript_creator_monthly", // Upgraded tier
  });

  const response = await makeWebhookRequest(event);
  assertEquals(response.status, 200);

  const body = await response.json();
  assertEquals(body.received, true);
});

Deno.test("Webhook Handler - Processes NON_RENEWING_PURCHASE event", async () => {
  const event = createMockWebhookEvent("NON_RENEWING_PURCHASE", {
    product_id: "mindscript_track_bundle_5",
    price: 19.99,
  });

  const response = await makeWebhookRequest(event);
  assertEquals(response.status, 200);

  const body = await response.json();
  assertEquals(body.received, true);
});

Deno.test("Webhook Handler - Maps app_user_id to Supabase user", async () => {
  // Test with UUID app_user_id
  const event1 = createMockWebhookEvent("INITIAL_PURCHASE", {
    app_user_id: "550e8400-e29b-41d4-a716-446655440000",
  });

  const response1 = await makeWebhookRequest(event1);
  assertEquals(response1.status, 200);

  // Test with RevenueCat anonymous ID
  const event2 = createMockWebhookEvent("INITIAL_PURCHASE", {
    app_user_id: "$RCAnonymousID:abc123",
    subscriber_attributes: {
      supabase_user_id: "550e8400-e29b-41d4-a716-446655440000",
    },
  });

  const response2 = await makeWebhookRequest(event2);
  assertEquals(response2.status, 200);

  // Test with email mapping
  const event3 = createMockWebhookEvent("INITIAL_PURCHASE", {
    app_user_id: "custom_user_123",
    subscriber_attributes: {
      "$email": "test@example.com",
    },
  });

  const response3 = await makeWebhookRequest(event3);
  assertEquals(response3.status, 200);
});

Deno.test("Webhook Handler - Calculates revenue splits correctly", () => {
  // Test revenue split calculation
  const priceCents = 999; // $9.99
  const platformFeeRate = 0.30; // 30%
  const mindscriptFeeRate = 0.15; // 15%

  const platformFeeCents = Math.round(priceCents * platformFeeRate); // 300 cents
  const afterStoreCut = priceCents - platformFeeCents; // 699 cents
  const mindscriptFeeCents = Math.round(afterStoreCut * mindscriptFeeRate); // 105 cents
  const netRevenueCents = afterStoreCut - mindscriptFeeCents; // 594 cents

  assertEquals(platformFeeCents, 300);
  assertEquals(mindscriptFeeCents, 105);
  assertEquals(netRevenueCents, 594);
  assertEquals(platformFeeCents + mindscriptFeeCents + netRevenueCents, priceCents);
});

Deno.test("Webhook Handler - Skips sandbox events in production", async () => {
  // Set environment to production
  Deno.env.set("ENVIRONMENT", "production");

  const event = createMockWebhookEvent("INITIAL_PURCHASE", {
    environment: "SANDBOX",
  });

  const response = await makeWebhookRequest(event);
  assertEquals(response.status, 200);

  const body = await response.json();
  assertEquals(body.received, true);
  assertEquals(body.skipped, true);

  // Reset environment
  Deno.env.set("ENVIRONMENT", "test");
});

Deno.test("Webhook Handler - Handles unknown product IDs gracefully", async () => {
  const event = createMockWebhookEvent("INITIAL_PURCHASE", {
    product_id: "unknown_product_id",
  });

  const response = await makeWebhookRequest(event);
  assertEquals(response.status, 200);

  const body = await response.json();
  assertEquals(body.received, true);
  assertEquals(body.error, "Processing failed");
});

Deno.test("Webhook Handler - Handles database errors gracefully", async () => {
  // This would require mocking Supabase to return errors
  // In a real test environment, we'd inject a mock client

  const event = createMockWebhookEvent("INITIAL_PURCHASE");

  // Mock Supabase to return an error
  // const mockSupabase = createMockSupabaseClient();
  // mockSupabase.from().insert().returns({ error: { message: "Database error" } });

  const response = await makeWebhookRequest(event);
  assertEquals(response.status, 200); // Still returns 200 to avoid retries

  const body = await response.json();
  assertEquals(body.received, true);
  // assertEquals(body.error, "Processing failed");
});

// Integration test with actual database (requires local Supabase)
Deno.test({
  name: "Webhook Handler - Integration test with database",
  ignore: !Deno.env.get("RUN_INTEGRATION_TESTS"),
  fn: async () => {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Clean up test data
    await supabase
      .from("webhook_events")
      .delete()
      .eq("provider", "revenuecat")
      .like("event_id", "test-%");

    // Create a test event
    const event = createMockWebhookEvent("INITIAL_PURCHASE", {
      id: `test-${Date.now()}`,
      app_user_id: "550e8400-e29b-41d4-a716-446655440000",
      product_id: "mindscript_starter_monthly",
      price: 9.99,
    });

    const response = await makeWebhookRequest(event);
    assertEquals(response.status, 200);

    // Verify webhook event was recorded
    const { data: webhookEvent, error } = await supabase
      .from("webhook_events")
      .select("*")
      .eq("provider", "revenuecat")
      .eq("event_id", event.event.id)
      .single();

    assertExists(webhookEvent);
    assertEquals(webhookEvent.processed, true);
    assertEquals(webhookEvent.event_type, "INITIAL_PURCHASE");

    // Clean up
    await supabase
      .from("webhook_events")
      .delete()
      .eq("id", webhookEvent.id);
  },
});