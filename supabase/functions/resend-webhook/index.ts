// Deno Edge Function for handling Resend webhooks
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Webhook } from "https://esm.sh/svix@1.15.0";

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Resend event types we handle
const RESEND_EVENT_TYPES = {
  SENT: "email.sent",
  DELIVERED: "email.delivered",
  DELIVERY_DELAYED: "email.delivery_delayed",
  BOUNCED: "email.bounced",
  COMPLAINED: "email.complained",
  OPENED: "email.opened",
  CLICKED: "email.clicked",
} as const;

type ResendEventType = typeof RESEND_EVENT_TYPES[keyof typeof RESEND_EVENT_TYPES];

// Resend webhook payload structure
interface ResendWebhookPayload {
  type: ResendEventType;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    // Event-specific fields
    bounce_type?: "hard" | "soft" | "block";
    bounce_description?: string;
    delay_description?: string;
    webhook_id?: string;
    // Click/Open tracking
    click?: {
      ipAddress: string;
      link: string;
      timestamp: number;
      userAgent: string;
    };
    open?: {
      ipAddress: string;
      timestamp: number;
      userAgent: string;
    };
  };
}

interface WebhookEvent {
  id: string;
  provider: string;
  event_id: string;
  event_type: string;
  payload: unknown;
  signature: string;
  processed: boolean;
  processed_at?: string;
  error_message?: string;
  retry_count: number;
  created_at: string;
}

/**
 * Structured logging helper
 */
function log(level: "info" | "warn" | "error", message: string, context?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    service: "resend-webhook",
    message,
    ...context,
  };
  console.log(JSON.stringify(logEntry));
}

/**
 * Verify Resend webhook signature using Svix
 */
async function verifyWebhookSignature(
  body: string,
  headers: Headers
): Promise<ResendWebhookPayload> {
  const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!webhookSecret) {
    throw new Error("RESEND_WEBHOOK_SECRET not configured");
  }

  // Get Svix headers
  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new Error("Missing required Svix headers");
  }

  // Create webhook instance with secret
  const webhook = new Webhook(webhookSecret);

  // Verify the webhook
  try {
    const payload = webhook.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ResendWebhookPayload;

    return payload;
  } catch (err) {
    throw new Error(`Webhook verification failed: ${err.message}`);
  }
}

/**
 * Main webhook handler
 */
async function handleWebhook(req: Request): Promise<Response> {
  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get request body
  const body = await req.text();

  // Verify webhook signature
  let payload: ResendWebhookPayload;
  try {
    payload = await verifyWebhookSignature(body, req.headers);
    log("info", "Webhook signature verified", {
      eventType: payload.type,
      emailId: payload.data.email_id,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    log("error", "Webhook signature verification failed", { error: errorMessage });
    return new Response(JSON.stringify({ error: "Invalid webhook signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Use email_id as the unique event identifier
  const eventId = `${payload.data.email_id}_${payload.type}_${payload.created_at}`;

  // Check for duplicate event (idempotency)
  const { data: existingEvent, error: fetchError } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("provider", "resend")
    .eq("event_id", eventId)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    // PGRST116 means no rows found, which is expected for new events
    log("error", "Failed to check for duplicate event", { error: fetchError.message });
    return new Response(JSON.stringify({ error: "Database error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (existingEvent) {
    log("info", "Duplicate webhook event, skipping", { eventId });
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Record the webhook event
  const signature = req.headers.get("svix-signature") || "";
  const { error: insertError } = await supabase.from("webhook_events").insert({
    provider: "resend",
    event_id: eventId,
    event_type: payload.type,
    payload: payload,
    signature: signature,
    processed: false,
    retry_count: 0,
  });

  if (insertError) {
    log("error", "Failed to record webhook event", { error: insertError.message });
    return new Response(JSON.stringify({ error: "Failed to record event" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Process different event types
    switch (payload.type) {
      case RESEND_EVENT_TYPES.SENT:
        await handleEmailSent(payload, supabase);
        break;

      case RESEND_EVENT_TYPES.DELIVERED:
        await handleEmailDelivered(payload, supabase);
        break;

      case RESEND_EVENT_TYPES.DELIVERY_DELAYED:
        await handleDeliveryDelayed(payload, supabase);
        break;

      case RESEND_EVENT_TYPES.BOUNCED:
        await handleEmailBounced(payload, supabase);
        break;

      case RESEND_EVENT_TYPES.COMPLAINED:
        await handleEmailComplained(payload, supabase);
        break;

      case RESEND_EVENT_TYPES.OPENED:
        await handleEmailOpened(payload, supabase);
        break;

      case RESEND_EVENT_TYPES.CLICKED:
        await handleEmailClicked(payload, supabase);
        break;

      default:
        log("warn", "Unhandled webhook event type", { eventType: payload.type });
    }

    // Mark event as processed
    await supabase
      .from("webhook_events")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq("provider", "resend")
      .eq("event_id", eventId);

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log("error", "Webhook processing error", { error: errorMessage, eventId });

    // Update event with error
    await supabase
      .from("webhook_events")
      .update({
        error_message: errorMessage,
        retry_count: 1,
      })
      .eq("provider", "resend")
      .eq("event_id", eventId);

    // Return success to avoid immediate Resend retries
    // We'll handle retries on our end if needed
    return new Response(JSON.stringify({ received: true, error: "Processing failed" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Handle email.sent event
 */
async function handleEmailSent(
  payload: ResendWebhookPayload,
  supabase: ReturnType<typeof createClient>
) {
  const { email_id, to, from, subject } = payload.data;
  const toEmail = to[0]; // Resend sends to array, we typically send to one recipient

  log("info", "Processing email sent event", { emailId: email_id, to: toEmail });

  // Update email log status
  const { error } = await supabase
    .from("email_logs")
    .update({
      status: "sent",
      sent_at: payload.created_at,
      updated_at: new Date().toISOString(),
    })
    .eq("resend_email_id", email_id);

  if (error) {
    log("error", "Failed to update email log", { error: error.message, emailId: email_id });
  }

  // Update user email preferences metrics
  await supabase.rpc("update_email_metrics", {
    p_email: toEmail,
    p_event_type: payload.type,
  });
}

/**
 * Handle email.delivered event
 */
async function handleEmailDelivered(
  payload: ResendWebhookPayload,
  supabase: ReturnType<typeof createClient>
) {
  const { email_id } = payload.data;
  const toEmail = payload.data.to[0];

  log("info", "Processing email delivered event", { emailId: email_id, to: toEmail });

  // Update email log status
  const { error } = await supabase
    .from("email_logs")
    .update({
      status: "delivered",
      delivered_at: payload.created_at,
      updated_at: new Date().toISOString(),
    })
    .eq("resend_email_id", email_id);

  if (error) {
    log("error", "Failed to update email log", { error: error.message, emailId: email_id });
  }
}

/**
 * Handle email.delivery_delayed event
 */
async function handleDeliveryDelayed(
  payload: ResendWebhookPayload,
  supabase: ReturnType<typeof createClient>
) {
  const { email_id, delay_description } = payload.data;
  const toEmail = payload.data.to[0];

  log("info", "Processing delivery delayed event", {
    emailId: email_id,
    to: toEmail,
    reason: delay_description,
  });

  // Update email log with delay information
  const { error } = await supabase
    .from("email_logs")
    .update({
      status: "delivery_delayed",
      delay_reason: delay_description || "Unknown delay reason",
      updated_at: new Date().toISOString(),
    })
    .eq("resend_email_id", email_id);

  if (error) {
    log("error", "Failed to update email log", { error: error.message, emailId: email_id });
  }
}

/**
 * Handle email.bounced event
 */
async function handleEmailBounced(
  payload: ResendWebhookPayload,
  supabase: ReturnType<typeof createClient>
) {
  const { email_id, bounce_type, bounce_description } = payload.data;
  const toEmail = payload.data.to[0];

  log("info", "Processing email bounced event", {
    emailId: email_id,
    to: toEmail,
    bounceType: bounce_type,
    reason: bounce_description,
  });

  // Update email log with bounce information
  const { error: logError } = await supabase
    .from("email_logs")
    .update({
      status: "bounced",
      bounced_at: payload.created_at,
      bounce_type: bounce_type || "hard",
      bounce_reason: bounce_description || "Unknown bounce reason",
      updated_at: new Date().toISOString(),
    })
    .eq("resend_email_id", email_id);

  if (logError) {
    log("error", "Failed to update email log", { error: logError.message, emailId: email_id });
  }

  // Update user email preferences for bounce handling
  const { data: emailLog } = await supabase
    .from("email_logs")
    .select("user_id")
    .eq("resend_email_id", email_id)
    .single();

  if (emailLog?.user_id) {
    // Check if user preferences exist
    const { data: existing } = await supabase
      .from("user_email_preferences")
      .select("id, bounce_count")
      .eq("user_id", emailLog.user_id)
      .eq("email", toEmail)
      .single();

    if (existing) {
      // Update existing preferences
      const newBounceCount = (existing.bounce_count || 0) + 1;
      const shouldSuppress = bounce_type === "hard" || newBounceCount >= 3;

      const { error: prefError } = await supabase
        .from("user_email_preferences")
        .update({
          bounce_count: newBounceCount,
          last_bounce_at: payload.created_at,
          last_bounce_type: bounce_type,
          is_suppressed: shouldSuppress,
          suppression_reason: shouldSuppress ? "hard_bounce" : null,
          suppressed_at: shouldSuppress ? payload.created_at : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (prefError) {
        log("error", "Failed to update email preferences", {
          error: prefError.message,
          userId: emailLog.user_id,
        });
      } else if (shouldSuppress) {
        log("info", "Email suppressed due to bounce", {
          userId: emailLog.user_id,
          email: toEmail,
          bounceType: bounce_type,
          bounceCount: newBounceCount,
        });
      }
    } else {
      // Create new preferences with bounce info
      const shouldSuppress = bounce_type === "hard";
      const { error: createError } = await supabase
        .from("user_email_preferences")
        .insert({
          user_id: emailLog.user_id,
          email: toEmail,
          bounce_count: 1,
          last_bounce_at: payload.created_at,
          last_bounce_type: bounce_type,
          is_suppressed: shouldSuppress,
          suppression_reason: shouldSuppress ? "hard_bounce" : null,
          suppressed_at: shouldSuppress ? payload.created_at : null,
        });

      if (createError) {
        log("error", "Failed to create email preferences", {
          error: createError.message,
          userId: emailLog.user_id,
        });
      }
    }
  }
}

/**
 * Handle email.complained event (spam complaint)
 */
async function handleEmailComplained(
  payload: ResendWebhookPayload,
  supabase: ReturnType<typeof createClient>
) {
  const { email_id } = payload.data;
  const toEmail = payload.data.to[0];

  log("info", "Processing spam complaint event", { emailId: email_id, to: toEmail });

  // Update email log
  const { error: logError } = await supabase
    .from("email_logs")
    .update({
      status: "complained",
      complained_at: payload.created_at,
      updated_at: new Date().toISOString(),
    })
    .eq("resend_email_id", email_id);

  if (logError) {
    log("error", "Failed to update email log", { error: logError.message, emailId: email_id });
  }

  // Get user ID from email log
  const { data: emailLog } = await supabase
    .from("email_logs")
    .select("user_id")
    .eq("resend_email_id", email_id)
    .single();

  if (emailLog?.user_id) {
    // Check if user preferences exist
    const { data: existing } = await supabase
      .from("user_email_preferences")
      .select("id, complaint_count")
      .eq("user_id", emailLog.user_id)
      .eq("email", toEmail)
      .single();

    if (existing) {
      // Always suppress on spam complaint
      const { error: prefError } = await supabase
        .from("user_email_preferences")
        .update({
          complaint_count: (existing.complaint_count || 0) + 1,
          last_complaint_at: payload.created_at,
          is_suppressed: true,
          suppression_reason: "spam_complaint",
          suppressed_at: payload.created_at,
          marketing_emails: false,
          weekly_digest: false,
          product_updates: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (prefError) {
        log("error", "Failed to update email preferences", {
          error: prefError.message,
          userId: emailLog.user_id,
        });
      } else {
        log("info", "Email suppressed due to spam complaint", {
          userId: emailLog.user_id,
          email: toEmail,
        });
      }
    } else {
      // Create new preferences with suppression
      const { error: createError } = await supabase
        .from("user_email_preferences")
        .insert({
          user_id: emailLog.user_id,
          email: toEmail,
          complaint_count: 1,
          last_complaint_at: payload.created_at,
          is_suppressed: true,
          suppression_reason: "spam_complaint",
          suppressed_at: payload.created_at,
          marketing_emails: false,
          weekly_digest: false,
          product_updates: false,
        });

      if (createError) {
        log("error", "Failed to create email preferences", {
          error: createError.message,
          userId: emailLog.user_id,
        });
      }
    }
  }
}

/**
 * Handle email.opened event
 */
async function handleEmailOpened(
  payload: ResendWebhookPayload,
  supabase: ReturnType<typeof createClient>
) {
  const { email_id, open } = payload.data;
  const toEmail = payload.data.to[0];

  log("info", "Processing email opened event", {
    emailId: email_id,
    to: toEmail,
    timestamp: open?.timestamp,
  });

  // Get current open count
  const { data: emailLog } = await supabase
    .from("email_logs")
    .select("open_count, opened_at")
    .eq("resend_email_id", email_id)
    .single();

  const currentCount = emailLog?.open_count || 0;
  const isFirstOpen = !emailLog?.opened_at;

  // Update email log
  const { error } = await supabase
    .from("email_logs")
    .update({
      open_count: currentCount + 1,
      opened_at: isFirstOpen ? payload.created_at : emailLog.opened_at,
      metadata: {
        last_open: {
          timestamp: open?.timestamp,
          ip_address: open?.ipAddress,
          user_agent: open?.userAgent,
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("resend_email_id", email_id);

  if (error) {
    log("error", "Failed to update email log", { error: error.message, emailId: email_id });
  }

  // Update user engagement metrics
  await supabase.rpc("update_email_metrics", {
    p_email: toEmail,
    p_event_type: payload.type,
  });
}

/**
 * Handle email.clicked event
 */
async function handleEmailClicked(
  payload: ResendWebhookPayload,
  supabase: ReturnType<typeof createClient>
) {
  const { email_id, click } = payload.data;
  const toEmail = payload.data.to[0];

  log("info", "Processing email clicked event", {
    emailId: email_id,
    to: toEmail,
    link: click?.link,
    timestamp: click?.timestamp,
  });

  // Get current click count
  const { data: emailLog } = await supabase
    .from("email_logs")
    .select("click_count, metadata")
    .eq("resend_email_id", email_id)
    .single();

  const currentCount = emailLog?.click_count || 0;
  const metadata = emailLog?.metadata || {};

  // Track clicked links
  if (!metadata.clicked_links) {
    metadata.clicked_links = [];
  }
  metadata.clicked_links.push({
    link: click?.link,
    timestamp: click?.timestamp,
    ip_address: click?.ipAddress,
    user_agent: click?.userAgent,
  });

  // Update email log
  const { error } = await supabase
    .from("email_logs")
    .update({
      click_count: currentCount + 1,
      last_clicked_at: payload.created_at,
      metadata: metadata,
      updated_at: new Date().toISOString(),
    })
    .eq("resend_email_id", email_id);

  if (error) {
    log("error", "Failed to update email log", { error: error.message, emailId: email_id });
  }

  // Update user engagement metrics
  await supabase.rpc("update_email_metrics", {
    p_email: toEmail,
    p_event_type: payload.type,
  });
}

// Start the server
serve(handleWebhook);