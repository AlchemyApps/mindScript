# RevenueCat Webhook Handler

This Supabase Edge Function processes In-App Purchase events from RevenueCat, maintaining cross-platform synchronization between iOS and Android purchases.

## Features

- ✅ Webhook signature verification
- ✅ Idempotent event processing
- ✅ Cross-platform user mapping
- ✅ Revenue split calculations
- ✅ Subscription lifecycle management
- ✅ One-time purchase handling
- ✅ Structured logging
- ✅ Graceful error handling

## Supported Events

- `INITIAL_PURCHASE` - First time purchase
- `RENEWAL` - Subscription renewed
- `CANCELLATION` - Subscription cancelled
- `NON_RENEWING_PURCHASE` - One-time purchase
- `EXPIRATION` - Subscription expired
- `BILLING_ISSUE` - Payment failed
- `PRODUCT_CHANGE` - Subscription tier change
- `UNCANCELLATION` - Subscription reactivated

## Setup

### 1. Environment Variables

Set the following environment variables in your Supabase project:

```bash
# RevenueCat webhook authorization token
REVENUECAT_WEBHOOK_AUTH_TOKEN=your-secret-token-here

# Supabase configuration (automatically set)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Environment (production/staging/development)
ENVIRONMENT=production
```

### 2. RevenueCat Configuration

1. Log in to your RevenueCat dashboard
2. Navigate to **Project Settings** → **Integrations** → **Webhooks**
3. Add a new webhook with:
   - **URL**: `https://your-project.supabase.co/functions/v1/revenuecat-webhook`
   - **Authorization Header**: `Bearer your-secret-token-here`
   - **Events**: Select all relevant events (purchases, renewals, cancellations, etc.)

### 3. Product ID Mapping

Configure your RevenueCat products with these IDs:

```typescript
// Subscription tiers
mindscript_intro_monthly    // $0.99 intro offer
mindscript_starter_monthly  // $9.99/month
mindscript_starter_yearly   // $99.99/year
mindscript_creator_monthly  // $19.99/month
mindscript_creator_yearly   // $199.99/year
mindscript_studio_monthly   // $39.99/month
mindscript_studio_yearly    // $399.99/year

// One-time purchases
mindscript_track_single     // $4.99 for 1 track
mindscript_track_bundle_5   // $19.99 for 5 tracks
mindscript_track_bundle_10  // $34.99 for 10 tracks
```

### 4. User Mapping

The webhook handler maps RevenueCat users to Supabase users using these strategies:

1. **Direct UUID**: If `app_user_id` is a valid UUID matching a Supabase user
2. **Custom Attribute**: Set `supabase_user_id` in RevenueCat subscriber attributes
3. **Email Lookup**: Use `$email` subscriber attribute to find matching user

Example RevenueCat SDK initialization:

```swift
// iOS
Purchases.configure(withAPIKey: "your-api-key")
Purchases.shared.logIn(supabaseUserId) { (purchaserInfo, created, error) in
    // Handle login
}

// Set custom attributes
Purchases.shared.setAttributes([
    "supabase_user_id": supabaseUserId,
    "$email": userEmail
])
```

```kotlin
// Android
Purchases.configure(this, "your-api-key")
Purchases.sharedInstance.logIn(supabaseUserId) { purchaserInfo, created, error ->
    // Handle login
}

// Set custom attributes
Purchases.sharedInstance.setAttributes(mapOf(
    "supabase_user_id" to supabaseUserId,
    "\$email" to userEmail
))
```

## Database Schema

The webhook handler requires these tables:

### webhook_events
Tracks all webhook events for idempotency:
- `id` - UUID primary key
- `provider` - 'revenuecat' or 'stripe'
- `event_id` - Unique event identifier
- `event_type` - Event type string
- `payload` - Full event payload (JSONB)
- `processed` - Processing status
- `error_message` - Error details if failed

### purchases
Records all purchase transactions:
- `buyer_id` - Supabase user ID
- `platform` - 'ios' or 'android'
- `sale_price_cents` - Total price in cents
- `revenuecat_transaction_id` - RevenueCat transaction ID
- `iap_product_id` - Product identifier
- `platform_fee_cents` - App Store/Play Store fee
- `seller_share_cents` - Net revenue after fees

### earnings_ledger
Tracks revenue for reporting:
- `seller_id` - User ID (for subscriptions, same as buyer)
- `purchase_id` - Reference to purchases table
- `gross_cents` - Total amount
- `platform_fee_cents` - Store commission
- `seller_earnings_cents` - Net earnings
- `channel` - 'ios' or 'android'

### user_subscriptions
Manages subscription state:
- `user_id` - Supabase user ID
- `tier` - Subscription tier
- `status` - 'active', 'cancelled', 'expired', 'past_due'
- `current_period_end` - Subscription expiration
- `revenuecat_product_id` - Current product

## Testing

### Local Development

1. Start local Supabase:
```bash
supabase start
```

2. Run the function locally:
```bash
supabase functions serve revenuecat-webhook --env-file ./supabase/functions/.env.local
```

3. Test with curl:
```bash
curl -X POST http://localhost:54321/functions/v1/revenuecat-webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-test-token" \
  -d @test-event.json
```

### Test Event Example

```json
{
  "api_version": "1.0",
  "event": {
    "id": "12345678-1234-1234-1234-123456789012",
    "type": "INITIAL_PURCHASE",
    "event_timestamp_ms": 1704067200000,
    "app_id": "app_abc123",
    "app_user_id": "550e8400-e29b-41d4-a716-446655440000",
    "original_app_user_id": "550e8400-e29b-41d4-a716-446655440000",
    "product_id": "mindscript_starter_monthly",
    "price": 9.99,
    "currency": "USD",
    "store": "APP_STORE",
    "environment": "SANDBOX",
    "store_transaction_id": "1000000123456789",
    "purchased_at_ms": 1704067200000,
    "expiration_at_ms": 1706745600000,
    "subscriber_attributes": {
      "$email": "user@example.com",
      "supabase_user_id": "550e8400-e29b-41d4-a716-446655440000"
    }
  }
}
```

### Running Tests

```bash
# Run all tests
deno test --allow-all supabase/functions/revenuecat-webhook/

# Run with coverage
deno test --allow-all --coverage=coverage supabase/functions/revenuecat-webhook/

# Run integration tests (requires local Supabase)
RUN_INTEGRATION_TESTS=true deno test --allow-all supabase/functions/revenuecat-webhook/
```

## Revenue Calculations

The webhook handler calculates revenue splits as follows:

1. **Platform Fee** (App Store/Play Store): 30% standard, 15% for small business
2. **MindScript Fee**: 15% of remaining amount after platform fee
3. **Net Revenue**: Remaining amount after all fees

Example for $9.99 purchase:
- Gross: $9.99 (999 cents)
- Platform fee (30%): $3.00 (300 cents)
- After platform: $6.99 (699 cents)
- MindScript fee (15%): $1.05 (105 cents)
- Net revenue: $5.94 (594 cents)

## Monitoring

Monitor webhook health using these queries:

```sql
-- Recent webhook events
SELECT
  event_type,
  processed,
  error_message,
  created_at
FROM webhook_events
WHERE provider = 'revenuecat'
ORDER BY created_at DESC
LIMIT 20;

-- Failed events requiring retry
SELECT *
FROM webhook_events
WHERE provider = 'revenuecat'
  AND processed = false
  AND error_message IS NOT NULL
  AND retry_count < 3;

-- Revenue by platform
SELECT
  platform,
  COUNT(*) as purchase_count,
  SUM(sale_price_cents) / 100.0 as total_revenue,
  SUM(seller_share_cents) / 100.0 as net_revenue
FROM purchases
WHERE platform IN ('ios', 'android')
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY platform;
```

## Troubleshooting

### Common Issues

1. **User mapping failures**
   - Ensure RevenueCat SDK is initialized with Supabase user ID
   - Set `supabase_user_id` custom attribute
   - Verify email attribute is set correctly

2. **Duplicate events**
   - Check `webhook_events` table for existing event_id
   - Verify idempotency logic is working
   - Look for retry storms from RevenueCat

3. **Authorization failures**
   - Verify `REVENUECAT_WEBHOOK_AUTH_TOKEN` matches dashboard
   - Check authorization header format: `Bearer TOKEN`
   - Ensure environment variables are set

4. **Database errors**
   - Verify service role key has proper permissions
   - Check for unique constraint violations
   - Monitor connection pool limits

## Security Considerations

- ✅ Always verify webhook authorization header
- ✅ Use service role key only in Edge Functions
- ✅ Never trust client-side purchase data
- ✅ Implement idempotency for all events
- ✅ Log all events for audit trail
- ✅ Use prepared statements for queries
- ✅ Sanitize all user inputs
- ✅ Rate limit webhook endpoints

## Support

For issues or questions:
1. Check RevenueCat webhook logs in dashboard
2. Review Supabase Edge Function logs
3. Query `webhook_events` table for processing status
4. Contact support with event IDs and timestamps