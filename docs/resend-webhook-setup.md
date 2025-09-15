# Resend Webhook Setup Documentation

## Overview

This document describes the Resend webhook integration for MindScript, which handles email delivery events to track email status, manage bounces/complaints, and provide email analytics.

## Architecture

### Components

1. **Supabase Edge Function** (`resend-webhook`)
   - Handles incoming webhook events from Resend
   - Verifies signatures using Svix
   - Updates email logs and user preferences
   - Manages bounce and complaint suppression

2. **Database Tables**
   - `email_logs`: Tracks all sent emails and their delivery status
   - `user_email_preferences`: Manages user email preferences and suppression
   - `webhook_events`: Stores raw webhook events for idempotency

3. **Email Metrics Utilities**
   - Analytics functions for email performance
   - User engagement tracking
   - Campaign metrics aggregation

## Setup Instructions

### 1. Environment Variables

Add these environment variables to your Supabase project:

```bash
# Resend Configuration
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# Already configured in Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. Database Migration

Run the email tracking migration to create necessary tables:

```bash
supabase migration up
```

This creates:
- `email_logs` table for tracking email delivery
- `user_email_preferences` table for managing preferences
- Helper functions and views for analytics

### 3. Deploy Edge Function

Deploy the Resend webhook handler:

```bash
# Deploy to Supabase
supabase functions deploy resend-webhook

# Set secrets
supabase secrets set RESEND_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### 4. Configure Resend Webhook

1. Log in to your [Resend dashboard](https://resend.com/webhooks)
2. Create a new webhook endpoint
3. Set the URL to: `https://your-project.supabase.co/functions/v1/resend-webhook`
4. Select the events to track:
   - `email.sent`
   - `email.delivered`
   - `email.delivery_delayed`
   - `email.bounced`
   - `email.complained`
   - `email.opened`
   - `email.clicked`
5. Copy the webhook signing secret and add it to your environment

## Event Handling

### Supported Events

| Event | Description | Actions Taken |
|-------|-------------|---------------|
| `email.sent` | Email accepted by Resend | Update status to "sent" |
| `email.delivered` | Email delivered to recipient | Update status to "delivered" |
| `email.delivery_delayed` | Temporary delivery issue | Log delay reason |
| `email.bounced` | Permanent delivery failure | Update preferences, suppress if hard bounce |
| `email.complained` | Marked as spam | Suppress user, disable marketing emails |
| `email.opened` | Email was opened | Track open count and timestamp |
| `email.clicked` | Link was clicked | Track clicks and clicked links |

### Bounce Handling

- **Hard Bounces**: Immediately suppress email address
- **Soft Bounces**: Track count, suppress after 3 soft bounces
- **Block Bounces**: Treat as hard bounce

### Complaint Handling

- Immediately suppress email address
- Disable all marketing emails
- Keep transactional emails enabled (configurable)

## Email Suppression Logic

Users are suppressed from receiving emails when:

1. **Hard Bounce**: Invalid email address, mailbox doesn't exist
2. **Spam Complaint**: User marked email as spam
3. **Multiple Soft Bounces**: 3+ soft bounces (mailbox full, etc.)
4. **Manual Suppression**: Admin action

## Testing

### Local Testing

1. Start Supabase locally:
```bash
supabase start
```

2. Run tests:
```bash
deno test supabase/functions/resend-webhook/index.test.ts --allow-net --allow-env
```

### Test Webhook Signatures

For testing, you can use the test webhook secret:
```
whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw
```

**Never use this in production!**

### Manual Testing with cURL

```bash
# Generate test payload
PAYLOAD='{"type":"email.sent","created_at":"2024-01-20T12:00:00Z","data":{"email_id":"re_test123","from":"noreply@mindscript.app","to":["user@example.com"],"subject":"Test Email"}}'

# You'll need to generate valid Svix headers for production testing
curl -X POST https://your-project.supabase.co/functions/v1/resend-webhook \
  -H "Content-Type: application/json" \
  -H "svix-id: msg_123" \
  -H "svix-timestamp: 1234567890" \
  -H "svix-signature: v1=..." \
  -d "$PAYLOAD"
```

## Monitoring

### Key Metrics to Track

1. **Delivery Rate**: Should be >95%
2. **Bounce Rate**: Should be <2%
3. **Complaint Rate**: Should be <0.1%
4. **Open Rate**: Varies by email type (20-40% typical)
5. **Click Rate**: Varies by content (2-10% typical)

### Database Queries

```sql
-- Get email metrics for last 30 days
SELECT * FROM email_campaign_metrics
WHERE campaign_started >= NOW() - INTERVAL '30 days';

-- Find suppressed users
SELECT * FROM user_email_preferences
WHERE is_suppressed = TRUE
ORDER BY suppressed_at DESC;

-- Check webhook processing status
SELECT
  event_type,
  COUNT(*) as count,
  COUNT(CASE WHEN processed THEN 1 END) as processed,
  COUNT(CASE WHEN error_message IS NOT NULL THEN 1 END) as errors
FROM webhook_events
WHERE provider = 'resend'
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY event_type;
```

### Error Monitoring

Monitor these logs for issues:

```sql
-- Failed webhook events
SELECT * FROM webhook_events
WHERE provider = 'resend'
  AND error_message IS NOT NULL
  AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Bounced emails
SELECT * FROM email_logs
WHERE status = 'bounced'
  AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

## Email Analytics

### Using Email Metrics Utilities

```typescript
import {
  calculateEmailMetrics,
  calculateUserEmailHealth,
  getInactiveUsers
} from "./email-metrics.ts";

// Get metrics for last 7 days
const metrics = await calculateEmailMetrics(
  supabase,
  new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  new Date(),
  "marketing"
);

// Check user email health
const health = await calculateUserEmailHealth(
  supabase,
  userId,
  "user@example.com"
);

// Find inactive users (30+ days)
const inactive = await getInactiveUsers(supabase, 30);
```

### Campaign Performance View

The `email_campaign_metrics` view provides aggregated metrics:

```sql
SELECT * FROM email_campaign_metrics
WHERE campaign_id = 'campaign_123';
```

Returns:
- Total sent, delivered, bounced, complained
- Open and click counts
- Calculated rates (delivery, open, click)
- Campaign duration

## Best Practices

### 1. Email Sending

- Always check `can_send_email()` function before sending
- Include unsubscribe links in marketing emails
- Use appropriate email types for categorization
- Set campaign IDs for bulk sends

### 2. Bounce Management

- Monitor bounce rates regularly
- Investigate sudden increases in bounces
- Clean email lists periodically
- Re-confirm old email addresses

### 3. Engagement Tracking

- Monitor open/click rates by email type
- A/B test subject lines and content
- Send emails at optimal times (use hourly metrics)
- Re-engage inactive users with targeted campaigns

### 4. Compliance

- Honor unsubscribe requests immediately
- Keep transactional emails separate from marketing
- Maintain suppression lists permanently
- Include physical address in emails (CAN-SPAM)

## Troubleshooting

### Common Issues

1. **Webhook signature verification fails**
   - Verify `RESEND_WEBHOOK_SECRET` is correct
   - Check Svix headers are present
   - Ensure body is raw text, not parsed JSON

2. **Duplicate events**
   - Idempotency check uses `email_id + event_type + timestamp`
   - Check `webhook_events` table for duplicates

3. **Events not processing**
   - Check Edge Function logs: `supabase functions logs resend-webhook`
   - Verify database permissions for service role
   - Check RLS policies on tables

4. **High bounce rates**
   - Verify email validation before sending
   - Check for typos in email addresses
   - Review sender reputation

### Debug Logging

Enable detailed logging by checking Edge Function logs:

```bash
supabase functions logs resend-webhook --tail
```

## Security Considerations

1. **Signature Verification**: All webhooks are verified using Svix
2. **Idempotency**: Duplicate events are ignored
3. **Rate Limiting**: Supabase Edge Functions have built-in rate limiting
4. **RLS Policies**: Only service role can write to webhook tables
5. **PII Protection**: Email addresses are stored securely
6. **Audit Trail**: All webhook events are logged

## Integration with Email Service

When sending emails through Resend, include metadata for tracking:

```typescript
await resend.emails.send({
  from: "MindScript <noreply@mindscript.app>",
  to: user.email,
  subject: "Your track is ready!",
  html: emailHtml,
  headers: {
    "X-Entity-Ref-ID": emailId, // Store as resend_email_id
  },
  tags: [
    { name: "type", value: "render_complete" },
    { name: "user_id", value: userId },
  ],
});

// Store email record
await supabase.from("email_logs").insert({
  resend_email_id: emailId,
  user_id: userId,
  to_email: user.email,
  from_email: "noreply@mindscript.app",
  subject: "Your track is ready!",
  email_type: "render_complete",
  status: "pending",
});
```

## Maintenance

### Regular Tasks

1. **Weekly**: Review bounce and complaint rates
2. **Monthly**: Clean up processed webhook events older than 90 days
3. **Quarterly**: Audit suppression list for false positives
4. **Annually**: Review and update email preferences schema

### Cleanup Script

```typescript
import { cleanupOldWebhookEvents } from "./email-metrics.ts";

// Run monthly to clean up old events
const deleted = await cleanupOldWebhookEvents(supabase, 90);
console.log(`Deleted ${deleted} old webhook events`);
```

## Support

For issues or questions:
1. Check Edge Function logs
2. Review webhook events table for errors
3. Consult Resend documentation
4. Check Supabase Edge Function documentation