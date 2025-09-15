# MindScript Payout System Implementation

## Overview
The payout system automates weekly payouts to marketplace sellers using Stripe Connect transfers with comprehensive reconciliation and notification capabilities.

## Core Components

### 1. Database Schema (`supabase/migrations/20250115000001_payout_schedule_system.sql`)
- **payout_schedule**: Manages scheduled payout configurations
- **payout_history**: Audit trail for all payout actions
- **payout_notifications**: Tracks seller notifications
- **payout_reconciliation**: Reconciliation between payouts and ledger
- **manual_payout_override**: Admin manual payout triggers

### 2. PayoutProcessor (`packages/payments/src/payouts/PayoutProcessor.ts`)
- **PayoutCalculator**: Calculates eligible payouts based on:
  - Minimum threshold: $10
  - Platform fee: 15%
  - Hold period: 7 days for dispute resolution
  - Multi-currency support
- **PayoutProcessor**: Processes payouts through Stripe Connect
  - Creates atomic transfers
  - Updates ledger entries
  - Handles failures with retry logic
  - Generates reconciliation reports

### 3. PayoutNotifier (`packages/payments/src/payouts/PayoutNotifier.ts`)
- Sends email notifications via Resend for:
  - Payout initiated
  - Payout completed
  - Payout failed
  - Weekly earnings summary
- HTML email templates with transaction details
- Processes notification queue from database

### 4. Scheduled Payouts Edge Function (`supabase/functions/scheduled-payouts/index.ts`)
- Triggered by pg_cron every hour
- Actions:
  - `check_schedules`: Process due payouts
  - `process_payout`: Process single schedule
  - `reconcile`: Verify payout accuracy
  - `retry_failed`: Retry failed transfers
- Handles multiple schedules and currencies

## Business Logic

### Payout Schedule
- **Frequency**: Weekly (Mondays at 00:00 UTC)
- **Minimum Threshold**: $10
- **Platform Fee**: 15% of seller earnings
- **Hold Period**: 7 days for dispute resolution
- **Processing Fee**: Accounted separately

### Payout Flow
1. pg_cron triggers scheduled-payouts function hourly
2. Function checks for due payouts
3. Calculates eligible sellers (balance > $10, outside hold period)
4. Creates payout records in database
5. Initiates Stripe transfers to Connect accounts
6. Updates earnings ledger with payout IDs
7. Sends completion notifications to sellers
8. Records audit trail in payout_history

### Reconciliation Process
- Compares payout amounts with ledger entries
- Detects and records discrepancies
- Generates reconciliation reports
- Allows manual resolution by admins

### Manual Override
- Admins can trigger manual payouts
- Requires approval workflow
- Tracked in manual_payout_override table

## Security Features
- Row Level Security (RLS) on all tables
- Service role only for sensitive operations
- Idempotent payout creation
- Atomic transaction processing
- Webhook signature verification
- Comprehensive audit logging

## Monitoring & Reporting
- Payout history tracking
- Failed payout retry mechanism
- Weekly earnings summaries
- Reconciliation reports
- Email notification status tracking

## Testing
Comprehensive Vitest test suites for:
- Payout calculation accuracy
- Multi-currency handling
- Hold period enforcement
- Failure recovery
- Notification delivery
- Reconciliation logic

## Configuration
Default configuration (adjustable per schedule):
```typescript
{
  minimumPayoutCents: 1000,    // $10
  platformFeePercent: 15,       // 15%
  holdPeriodDays: 7,           // 7 days
  schedule: 'weekly',          // Every Monday
  hour_utc: 0                  // Midnight UTC
}
```

## API Endpoints
The system integrates with existing endpoints:
- `/api/payouts` - View payout history
- `/api/earnings` - View earnings summary
- `/api/settings/payouts` - Manage payout settings

## Error Handling
- Failed transfers are automatically retried
- Sellers notified of failures with action items
- Admin alerts for reconciliation discrepancies
- Dead letter queue for failed notifications

## Future Enhancements
- [ ] Support for additional payout frequencies (daily, bi-weekly, monthly)
- [ ] Multi-currency conversion rates
- [ ] Tax withholding calculations
- [ ] Instant payouts for premium sellers
- [ ] Payout scheduling preferences per seller
- [ ] Advanced fraud detection
- [ ] Bulk manual payout processing