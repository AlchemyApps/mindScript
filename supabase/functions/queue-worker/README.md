# Queue Worker System

A robust, scalable background job processing system for MindScript built on Supabase Edge Functions.

## Features

- **Generic Job Queue**: Supports multiple job types (email, audio rendering, payouts, analytics)
- **SKIP LOCKED Pattern**: PostgreSQL-based concurrent job processing with atomic locking
- **Retry Logic**: Exponential backoff with configurable max retries
- **Dead Letter Queue**: Failed jobs exceeding retry limits are moved to DLQ
- **Priority Processing**: Critical > High > Normal > Low priority support
- **Job Dependencies**: Jobs can depend on completion of other jobs
- **Rate Limiting**: Built-in rate limiting per key
- **Batch Processing**: Process multiple jobs in a single invocation
- **Progress Tracking**: Real-time job progress updates
- **Health Monitoring**: Worker and processor health checks
- **Scheduled Jobs**: pg_cron integration for recurring tasks

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Application   │─────▶│   Job Queue DB   │◀─────│  Queue Worker   │
└─────────────────┘      └──────────────────┘      └─────────────────┘
                                  │                          │
                                  ▼                          ▼
                         ┌──────────────────┐      ┌─────────────────┐
                         │  Dead Letter Q   │      │   Processors    │
                         └──────────────────┘      └─────────────────┘
                                                            │
                                                    ┌───────┼───────┐
                                                    │       │       │
                                                Email  Audio  Payout Analytics
```

## Database Schema

### Main Tables

- **job_queue**: Primary job storage with status tracking
- **job_dead_letter**: Failed jobs exceeding retry limits
- **job_status_history**: Audit trail of status changes

### Key Functions

- `enqueue_job()`: Add new jobs to the queue
- `get_next_job()`: Atomically fetch and lock jobs for processing
- `complete_job()`: Mark job as successfully completed
- `fail_job()`: Handle job failure with retry logic
- `cleanup_stuck_jobs()`: Reset stuck jobs for retry

## Job Types

### Email Processor
Handles transactional emails via Resend API
- Welcome emails
- Track completion notifications
- Payout confirmations

### Audio Processor
Integrates with existing audio-processor Edge Function
- Delegates to specialized audio rendering pipeline
- Monitors progress and completion
- Sends completion notifications

### Payout Processor
Manages seller payouts via Stripe Connect
- Weekly scheduled payouts
- Minimum threshold enforcement
- Ledger reconciliation
- Platform fee calculation

### Analytics Processor
Aggregates platform metrics
- User growth metrics
- Track statistics
- Marketplace performance
- Engagement analytics

## Usage

### Enqueue a Job

```typescript
// From application code
const { data: jobId } = await supabase.rpc('enqueue_job', {
  p_type: 'email',
  p_payload: {
    to: 'user@example.com',
    subject: 'Welcome!',
    template: 'welcome',
    templateData: { name: 'John' }
  },
  p_priority: 'normal'
})
```

### Process Jobs

Jobs are automatically processed by scheduled workers. Manual processing:

```bash
# Process all pending jobs
curl -X POST https://your-project.supabase.co/functions/v1/queue-worker \
  -H "Authorization: Bearer YOUR_SERVICE_KEY"

# Process specific job type
curl -X POST https://your-project.supabase.co/functions/v1/queue-worker?type=email&batch=10 \
  -H "Authorization: Bearer YOUR_SERVICE_KEY"
```

### Monitor Health

```bash
# Health check
curl https://your-project.supabase.co/functions/v1/queue-worker?action=health \
  -H "Authorization: Bearer YOUR_SERVICE_KEY"

# Queue statistics
curl https://your-project.supabase.co/functions/v1/queue-worker?action=stats \
  -H "Authorization: Bearer YOUR_SERVICE_KEY"
```

## Configuration

### Environment Variables

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key
RESEND_API_KEY=your-resend-key           # For email processor
STRIPE_SECRET_KEY=your-stripe-key        # For payout processor
OPENAI_API_KEY=your-openai-key          # For audio processor
ELEVENLABS_API_KEY=your-elevenlabs-key  # For audio processor
```

### Scheduled Jobs (pg_cron)

```sql
-- Process queue every minute
SELECT cron.schedule('process-queue', '* * * * *',
  $$ SELECT trigger_queue_worker('process', NULL, 5); $$
);

-- Weekly payouts (Mondays 9 AM UTC)
SELECT cron.schedule('weekly-payouts', '0 9 * * 1',
  $$ -- Payout job creation logic $$
);

-- Daily analytics (2 AM UTC)
SELECT cron.schedule('daily-analytics', '0 2 * * *',
  $$ -- Analytics job creation logic $$
);
```

## Deployment

1. **Apply migrations**:
```bash
supabase db push
```

2. **Deploy Edge Functions**:
```bash
supabase functions deploy queue-worker --no-verify-jwt
```

3. **Set secrets**:
```bash
supabase secrets set RESEND_API_KEY=your-key
supabase secrets set STRIPE_SECRET_KEY=your-key
```

4. **Enable pg_cron** in Supabase dashboard

## Monitoring

### Admin Dashboard
Access the monitoring dashboard at `/admin/monitoring/queue`:
- Real-time job statistics
- Worker health status
- Recent job history
- Dead letter queue alerts
- Manual retry/cancel controls

### Metrics Tracked
- Jobs processed per type
- Success/failure rates
- Average processing time
- Queue depth
- Worker health status

## Error Handling

### Retry Strategy
- Exponential backoff: `delay = baseDelay * 2^retryCount`
- Default max retries: 3
- Configurable per job

### Dead Letter Queue
Jobs exceeding max retries are moved to DLQ for manual review:
- Preserves original payload
- Tracks error history
- Allows manual reprocessing

### Circuit Breaker
Processors implement circuit breaker pattern for external services:
- Prevents cascading failures
- Automatic recovery attempts
- Fallback mechanisms

## Testing

Run tests:
```bash
deno test supabase/functions/queue-worker/queue-worker.test.ts \
  --allow-net --allow-env
```

Test coverage includes:
- Concurrent job processing
- Retry logic
- Dead letter queue
- Priority processing
- Rate limiting
- Batch processing
- Dependency handling

## Performance

### Optimization Strategies
- SKIP LOCKED for lock-free concurrency
- Batch processing for efficiency
- Index optimization for queue queries
- Connection pooling
- Timeout protection

### Benchmarks
- Throughput: ~100 jobs/second per worker
- Latency: <100ms job acquisition
- Concurrency: 10+ parallel workers supported

## Security

- Row Level Security on all tables
- Service role authentication for workers
- Input validation on all processors
- Secure secret management
- Audit logging for compliance

## Future Enhancements

- [ ] Job scheduling UI
- [ ] Advanced retry strategies
- [ ] Job result caching
- [ ] Webhook notifications
- [ ] GraphQL subscriptions for real-time updates
- [ ] Distributed tracing integration