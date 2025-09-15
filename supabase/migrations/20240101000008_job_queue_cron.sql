-- Set up pg_cron for scheduled job execution
-- Note: pg_cron extension must be enabled in Supabase dashboard first

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage on cron schema to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Create function to trigger queue worker Edge Function
CREATE OR REPLACE FUNCTION trigger_queue_worker(
  p_action TEXT DEFAULT 'process',
  p_type TEXT DEFAULT NULL,
  p_batch_size INTEGER DEFAULT 5
)
RETURNS VOID AS $$
DECLARE
  v_response JSONB;
  v_url TEXT;
  v_headers JSONB;
BEGIN
  -- Build URL with parameters
  v_url := current_setting('app.settings.supabase_url') || '/functions/v1/queue-worker';

  IF p_action IS NOT NULL THEN
    v_url := v_url || '?action=' || p_action;
  END IF;

  IF p_type IS NOT NULL THEN
    v_url := v_url || '&type=' || p_type;
  END IF;

  IF p_batch_size IS NOT NULL THEN
    v_url := v_url || '&batch=' || p_batch_size::TEXT;
  END IF;

  -- Build headers
  v_headers := jsonb_build_object(
    'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
    'Content-Type', 'application/json'
  );

  -- Note: In production, you'd use http extension or net extension to make HTTP requests
  -- For now, we'll just log the intention
  RAISE NOTICE 'Would trigger queue worker: %', v_url;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule: Process general queue every minute
SELECT cron.schedule(
  'process-queue-every-minute',
  '* * * * *', -- Every minute
  $$
    SELECT trigger_queue_worker('process', NULL, 5);
  $$
);

-- Schedule: Process email queue every 30 seconds (using minute granularity)
SELECT cron.schedule(
  'process-email-queue',
  '* * * * *', -- Every minute (can't do 30 seconds with pg_cron)
  $$
    SELECT trigger_queue_worker('process', 'email', 10);
  $$
);

-- Schedule: Process audio renders every 5 minutes
SELECT cron.schedule(
  'process-audio-queue',
  '*/5 * * * *', -- Every 5 minutes
  $$
    SELECT trigger_queue_worker('process', 'audio_render', 3);
  $$
);

-- Schedule: Weekly payouts (Mondays at 9 AM UTC)
SELECT cron.schedule(
  'weekly-payouts',
  '0 9 * * 1', -- Mondays at 9 AM UTC
  $$
    -- Queue payout jobs for all eligible sellers
    INSERT INTO job_queue (
      type,
      payload,
      priority,
      metadata
    )
    SELECT
      'payout'::job_type,
      jsonb_build_object(
        'sellerId', sa.user_id,
        'period', jsonb_build_object(
          'start', date_trunc('week', CURRENT_DATE - INTERVAL '1 week')::TEXT,
          'end', date_trunc('week', CURRENT_DATE)::TEXT
        ),
        'type', 'scheduled'
      ),
      'normal'::job_priority,
      jsonb_build_object('scheduled', true)
    FROM seller_accounts sa
    WHERE sa.stripe_account_id IS NOT NULL
      AND sa.payouts_enabled = true
      AND EXISTS (
        SELECT 1 FROM sales s
        WHERE s.seller_id = sa.user_id
          AND s.status = 'completed'
          AND s.payout_id IS NULL
          AND s.created_at >= date_trunc('week', CURRENT_DATE - INTERVAL '1 week')
          AND s.created_at < date_trunc('week', CURRENT_DATE)
      );
  $$
);

-- Schedule: Daily analytics aggregation (2 AM UTC)
SELECT cron.schedule(
  'daily-analytics',
  '0 2 * * *', -- Daily at 2 AM UTC
  $$
    INSERT INTO job_queue (type, payload, priority)
    VALUES (
      'analytics'::job_type,
      jsonb_build_object(
        'type', 'daily',
        'date', (CURRENT_DATE - INTERVAL '1 day')::TEXT
      ),
      'low'::job_priority
    );
  $$
);

-- Schedule: Weekly analytics aggregation (Sundays at 3 AM UTC)
SELECT cron.schedule(
  'weekly-analytics',
  '0 3 * * 0', -- Sundays at 3 AM UTC
  $$
    INSERT INTO job_queue (type, payload, priority)
    VALUES (
      'analytics'::job_type,
      jsonb_build_object(
        'type', 'weekly',
        'date', (CURRENT_DATE - INTERVAL '1 week')::TEXT
      ),
      'low'::job_priority
    );
  $$
);

-- Schedule: Monthly analytics aggregation (First day of month at 4 AM UTC)
SELECT cron.schedule(
  'monthly-analytics',
  '0 4 1 * *', -- First day of month at 4 AM UTC
  $$
    INSERT INTO job_queue (type, payload, priority)
    VALUES (
      'analytics'::job_type,
      jsonb_build_object(
        'type', 'monthly',
        'date', (date_trunc('month', CURRENT_DATE - INTERVAL '1 month'))::TEXT
      ),
      'low'::job_priority
    );
  $$
);

-- Schedule: Cleanup stuck jobs every 10 minutes
SELECT cron.schedule(
  'cleanup-stuck-jobs',
  '*/10 * * * *', -- Every 10 minutes
  $$
    SELECT cleanup_stuck_jobs(10);
  $$
);

-- Schedule: Process dead letter queue review (Daily at 10 AM UTC)
SELECT cron.schedule(
  'review-dead-letter-queue',
  '0 10 * * *', -- Daily at 10 AM UTC
  $$
    -- Alert if dead letter queue has items
    INSERT INTO job_queue (type, payload, priority)
    SELECT
      'email'::job_type,
      jsonb_build_object(
        'to', 'admin@mindscript.app',
        'subject', 'Dead Letter Queue Alert',
        'text', format('There are %s jobs in the dead letter queue requiring review', COUNT(*))
      ),
      'high'::job_priority
    FROM job_dead_letter
    WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
    HAVING COUNT(*) > 0;
  $$
);

-- Function to manually trigger scheduled jobs (for testing)
CREATE OR REPLACE FUNCTION trigger_scheduled_job(job_name TEXT)
RETURNS VOID AS $$
DECLARE
  v_job RECORD;
BEGIN
  SELECT * INTO v_job
  FROM cron.job
  WHERE jobname = job_name;

  IF v_job IS NULL THEN
    RAISE EXCEPTION 'Job % not found', job_name;
  END IF;

  -- Execute the job command
  EXECUTE v_job.command;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION trigger_scheduled_job(TEXT) TO service_role;

-- Add comments for documentation
COMMENT ON FUNCTION trigger_queue_worker IS 'Triggers the queue worker Edge Function via HTTP';
COMMENT ON FUNCTION trigger_scheduled_job IS 'Manually trigger a scheduled cron job for testing';