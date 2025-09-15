# Stripe Webhook Handler

Supabase Edge Function for processing Stripe webhook events with idempotency and structured error handling.

## Features

- **Signature Verification**: Cryptographically verifies webhook signatures using Stripe SDK
- **Idempotency**: Prevents duplicate event processing using `webhook_events` table
- **Event Handlers**: Processes key Stripe events:
  - `checkout.session.completed` - Creates purchase records and earnings ledger entries
  - `account.updated` - Updates seller agreement status
  - `transfer.created` - Records payout initiation
  - `transfer.paid` - Marks payouts as completed
  - `transfer.failed` - Handles failed payouts
  - `charge.refunded` - Processes refunds
- **Structured Logging**: JSON-formatted logs with context for debugging
- **Error Recovery**: Graceful error handling with retry support

## Setup

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

The `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically provided by Supabase.

### Database Requirements

This function requires the following tables:
- `webhook_events` - For idempotency checking
- `purchases` - To record completed purchases
- `earnings_ledger` - To track seller earnings
- `seller_agreements` - For seller account status
- `payouts` - To track transfer status

### Webhook Configuration

1. In Stripe Dashboard, add the webhook endpoint:
   ```
   https://[PROJECT_REF].supabase.co/functions/v1/stripe-webhook
   ```

2. Select the events to listen for:
   - `checkout.session.completed`
   - `account.updated`
   - `transfer.created`
   - `transfer.paid`
   - `transfer.failed`
   - `charge.refunded`

3. Copy the webhook signing secret to your environment variables

## Deployment

Deploy the function to Supabase:

```bash
supabase functions deploy stripe-webhook
```

Set the secrets:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

## Testing

Run the test suite:

```bash
deno test --allow-env index.test.ts
```

For local testing with Stripe CLI:

```bash
# Forward webhooks to local function
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook

# Trigger test events
stripe trigger checkout.session.completed
```

## Architecture

### Processing Flow

1. **Signature Verification**: Validates the webhook signature using Stripe SDK
2. **Idempotency Check**: Queries `webhook_events` table for duplicate `event_id`
3. **Event Recording**: Inserts event into `webhook_events` table
4. **Event Processing**: Routes to appropriate handler based on event type
5. **Status Update**: Marks event as processed or failed

### Fee Calculation

For purchases, the function calculates:
- **Processing Fee**: 2.9% + $0.30 (Stripe standard)
- **Platform Fee**: Configurable percentage (default 15%)
- **Seller Earnings**: Remaining amount after fees

### Error Handling

- **Signature Failures**: Return 400 to indicate invalid request
- **Duplicate Events**: Return 200 with `duplicate: true` flag
- **Processing Errors**: Return 200 to prevent immediate Stripe retries, log error for manual review
- **Database Errors**: Return 500 for critical failures

## Monitoring

Monitor function execution in Supabase Dashboard:
- Function logs show structured JSON output
- Check `webhook_events` table for processing status
- Monitor `error_message` column for failed events

## Security

- Uses service role key for database operations
- Validates all webhook signatures
- Implements row-level security on database tables
- No sensitive data in logs