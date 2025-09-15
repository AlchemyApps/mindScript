// Deno tests for Resend webhook handler
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Webhook } from "https://esm.sh/svix@1.15.0";

// Test webhook secret (for testing only)
const TEST_WEBHOOK_SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";

/**
 * Generate a valid Svix signature for testing
 */
function generateSvixSignature(payload: string, secret: string): Headers {
  const webhook = new Webhook(secret);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const msgId = "msg_" + crypto.randomUUID();

  // Generate signature using Svix
  const signature = webhook.sign(msgId, timestamp, payload);

  const headers = new Headers();
  headers.set("svix-id", msgId);
  headers.set("svix-timestamp", timestamp);
  headers.set("svix-signature", signature);
  headers.set("Content-Type", "application/json");

  return headers;
}

/**
 * Create a mock Resend webhook payload
 */
function createMockPayload(
  type: string,
  emailId?: string,
  additionalData?: Record<string, unknown>
): string {
  const payload = {
    type,
    created_at: new Date().toISOString(),
    data: {
      email_id: emailId || "re_" + crypto.randomUUID(),
      from: "noreply@mindscript.app",
      to: ["user@example.com"],
      subject: "Test Email",
      created_at: new Date().toISOString(),
      ...additionalData,
    },
  };

  return JSON.stringify(payload);
}

Deno.test("Webhook handler - Invalid method", async () => {
  const response = await fetch("http://localhost:54321/functions/v1/resend-webhook", {
    method: "GET",
  });

  assertEquals(response.status, 405);
  const body = await response.json();
  assertEquals(body.error, "Method not allowed");
});

Deno.test("Webhook handler - Missing signature", async () => {
  const payload = createMockPayload("email.sent");

  const response = await fetch("http://localhost:54321/functions/v1/resend-webhook", {
    method: "POST",
    body: payload,
    headers: {
      "Content-Type": "application/json",
    },
  });

  assertEquals(response.status, 400);
  const body = await response.json();
  assertEquals(body.error, "Invalid webhook signature");
});

Deno.test("Webhook handler - Invalid signature", async () => {
  const payload = createMockPayload("email.sent");

  const headers = new Headers();
  headers.set("svix-id", "msg_123");
  headers.set("svix-timestamp", "1234567890");
  headers.set("svix-signature", "invalid_signature");
  headers.set("Content-Type", "application/json");

  const response = await fetch("http://localhost:54321/functions/v1/resend-webhook", {
    method: "POST",
    body: payload,
    headers,
  });

  assertEquals(response.status, 400);
  const body = await response.json();
  assertEquals(body.error, "Invalid webhook signature");
});

Deno.test("Webhook handler - Valid email.sent event", async () => {
  // This test requires RESEND_WEBHOOK_SECRET to be set
  Deno.env.set("RESEND_WEBHOOK_SECRET", TEST_WEBHOOK_SECRET);

  const payload = createMockPayload("email.sent");
  const headers = generateSvixSignature(payload, TEST_WEBHOOK_SECRET);

  const response = await fetch("http://localhost:54321/functions/v1/resend-webhook", {
    method: "POST",
    body: payload,
    headers,
  });

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.received, true);
});

Deno.test("Webhook handler - Valid email.delivered event", async () => {
  Deno.env.set("RESEND_WEBHOOK_SECRET", TEST_WEBHOOK_SECRET);

  const payload = createMockPayload("email.delivered");
  const headers = generateSvixSignature(payload, TEST_WEBHOOK_SECRET);

  const response = await fetch("http://localhost:54321/functions/v1/resend-webhook", {
    method: "POST",
    body: payload,
    headers,
  });

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.received, true);
});

Deno.test("Webhook handler - Valid email.bounced event", async () => {
  Deno.env.set("RESEND_WEBHOOK_SECRET", TEST_WEBHOOK_SECRET);

  const payload = createMockPayload("email.bounced", undefined, {
    bounce_type: "hard",
    bounce_description: "Mailbox does not exist",
  });
  const headers = generateSvixSignature(payload, TEST_WEBHOOK_SECRET);

  const response = await fetch("http://localhost:54321/functions/v1/resend-webhook", {
    method: "POST",
    body: payload,
    headers,
  });

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.received, true);
});

Deno.test("Webhook handler - Valid email.complained event", async () => {
  Deno.env.set("RESEND_WEBHOOK_SECRET", TEST_WEBHOOK_SECRET);

  const payload = createMockPayload("email.complained");
  const headers = generateSvixSignature(payload, TEST_WEBHOOK_SECRET);

  const response = await fetch("http://localhost:54321/functions/v1/resend-webhook", {
    method: "POST",
    body: payload,
    headers,
  });

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.received, true);
});

Deno.test("Webhook handler - Valid email.opened event", async () => {
  Deno.env.set("RESEND_WEBHOOK_SECRET", TEST_WEBHOOK_SECRET);

  const payload = createMockPayload("email.opened", undefined, {
    open: {
      ipAddress: "192.168.1.1",
      timestamp: Date.now(),
      userAgent: "Mozilla/5.0",
    },
  });
  const headers = generateSvixSignature(payload, TEST_WEBHOOK_SECRET);

  const response = await fetch("http://localhost:54321/functions/v1/resend-webhook", {
    method: "POST",
    body: payload,
    headers,
  });

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.received, true);
});

Deno.test("Webhook handler - Valid email.clicked event", async () => {
  Deno.env.set("RESEND_WEBHOOK_SECRET", TEST_WEBHOOK_SECRET);

  const payload = createMockPayload("email.clicked", undefined, {
    click: {
      ipAddress: "192.168.1.1",
      link: "https://mindscript.app/track/123",
      timestamp: Date.now(),
      userAgent: "Mozilla/5.0",
    },
  });
  const headers = generateSvixSignature(payload, TEST_WEBHOOK_SECRET);

  const response = await fetch("http://localhost:54321/functions/v1/resend-webhook", {
    method: "POST",
    body: payload,
    headers,
  });

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.received, true);
});

Deno.test("Webhook handler - Idempotency check", async () => {
  Deno.env.set("RESEND_WEBHOOK_SECRET", TEST_WEBHOOK_SECRET);

  const emailId = "re_" + crypto.randomUUID();
  const payload = createMockPayload("email.sent", emailId);
  const headers = generateSvixSignature(payload, TEST_WEBHOOK_SECRET);

  // First request
  const response1 = await fetch("http://localhost:54321/functions/v1/resend-webhook", {
    method: "POST",
    body: payload,
    headers: headers,
  });

  assertEquals(response1.status, 200);
  const body1 = await response1.json();
  assertEquals(body1.received, true);

  // Second request with same payload (should be marked as duplicate)
  const response2 = await fetch("http://localhost:54321/functions/v1/resend-webhook", {
    method: "POST",
    body: payload,
    headers: headers,
  });

  assertEquals(response2.status, 200);
  const body2 = await response2.json();
  assertEquals(body2.received, true);
  assertEquals(body2.duplicate, true);
});

// Unit tests for helper functions (if exported)
Deno.test("Signature generation - Creates valid headers", () => {
  const payload = createMockPayload("email.sent");
  const headers = generateSvixSignature(payload, TEST_WEBHOOK_SECRET);

  assertExists(headers.get("svix-id"));
  assertExists(headers.get("svix-timestamp"));
  assertExists(headers.get("svix-signature"));

  // Verify signature format (v1=...)
  const signature = headers.get("svix-signature");
  assertEquals(signature?.startsWith("v1="), true);
});

Deno.test("Mock payload generation - Creates valid structure", () => {
  const payload = createMockPayload("email.bounced", undefined, {
    bounce_type: "soft",
    bounce_description: "Mailbox full",
  });

  const parsed = JSON.parse(payload);

  assertEquals(parsed.type, "email.bounced");
  assertExists(parsed.created_at);
  assertExists(parsed.data.email_id);
  assertEquals(parsed.data.from, "noreply@mindscript.app");
  assertEquals(parsed.data.to[0], "user@example.com");
  assertEquals(parsed.data.bounce_type, "soft");
  assertEquals(parsed.data.bounce_description, "Mailbox full");
});

// Integration test with mock Supabase
Deno.test("Integration - Process bounce and update preferences", async () => {
  // This test would require a test database or mocking Supabase
  // For now, we'll just test the webhook endpoint response

  Deno.env.set("RESEND_WEBHOOK_SECRET", TEST_WEBHOOK_SECRET);

  const payload = createMockPayload("email.bounced", undefined, {
    bounce_type: "hard",
    bounce_description: "Invalid email address",
  });
  const headers = generateSvixSignature(payload, TEST_WEBHOOK_SECRET);

  const response = await fetch("http://localhost:54321/functions/v1/resend-webhook", {
    method: "POST",
    body: payload,
    headers,
  });

  assertEquals(response.status, 200);

  // In a real test, we would verify:
  // 1. webhook_events table has the event recorded
  // 2. email_logs table status is updated to "bounced"
  // 3. user_email_preferences is updated with bounce info
  // 4. User is suppressed if it's a hard bounce
});

// Test for delivery delay handling
Deno.test("Webhook handler - Delivery delayed event", async () => {
  Deno.env.set("RESEND_WEBHOOK_SECRET", TEST_WEBHOOK_SECRET);

  const payload = createMockPayload("email.delivery_delayed", undefined, {
    delay_description: "Temporary server issue",
  });
  const headers = generateSvixSignature(payload, TEST_WEBHOOK_SECRET);

  const response = await fetch("http://localhost:54321/functions/v1/resend-webhook", {
    method: "POST",
    body: payload,
    headers,
  });

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.received, true);
});

// Test error handling
Deno.test("Webhook handler - Database error simulation", async () => {
  // This test would simulate a database error by:
  // 1. Setting invalid database credentials
  // 2. Or using a mock that throws errors
  // The handler should still return 200 to prevent Resend retries

  Deno.env.set("RESEND_WEBHOOK_SECRET", TEST_WEBHOOK_SECRET);
  Deno.env.set("SUPABASE_URL", "https://invalid.supabase.co");

  const payload = createMockPayload("email.sent");
  const headers = generateSvixSignature(payload, TEST_WEBHOOK_SECRET);

  const response = await fetch("http://localhost:54321/functions/v1/resend-webhook", {
    method: "POST",
    body: payload,
    headers,
  });

  // Should still return 200 to avoid retries
  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.received, true);
  // In production, this would have error: "Processing failed"
});