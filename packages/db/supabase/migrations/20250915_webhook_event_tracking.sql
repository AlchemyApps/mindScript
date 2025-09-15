-- Migration: Webhook Event Tracking with Idempotency Support
-- Phase: Infrastructure - Webhook Processing
-- Description: Creates comprehensive webhook event tracking system for Stripe, RevenueCat, and Resend
-- ensuring idempotency and providing audit trails for all webhook processing

-- ============================================================================
-- STEP 1: Create webhook source enum type
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'webhook_source') THEN
    CREATE TYPE webhook_source AS ENUM ('stripe', 'revenuecat', 'resend', 'github', 'supabase');
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Create webhook event status enum type
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'webhook_status') THEN
    CREATE TYPE webhook_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'skipped');
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Create webhook_events table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_events (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL, -- Provider's unique event ID
  source webhook_source NOT NULL, -- Which service sent this webhook

  -- Event details
  event_type TEXT NOT NULL, -- e.g., 'checkout.session.completed', 'subscription.renewed'
  payload JSONB NOT NULL, -- Complete webhook payload
  headers JSONB, -- HTTP headers for debugging/verification

  -- Processing status
  status webhook_status DEFAULT 'pending' NOT NULL,
  processing_started_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  processing_duration_ms INTEGER, -- Processing time in milliseconds

  -- Error tracking
  error_message TEXT,
  error_details JSONB,
  retry_count INTEGER DEFAULT 0 CHECK (retry_count >= 0),
  last_retry_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,

  -- Metadata
  environment TEXT DEFAULT 'production' CHECK (environment IN ('development', 'staging', 'production')),
  api_version TEXT, -- Provider API version
  signature_verified BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Ensure idempotency: same event_id from same source cannot be processed twice
  CONSTRAINT webhook_events_idempotency_key UNIQUE (event_id, source)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON public.webhook_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON public.webhook_events(status) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_webhook_events_source_type ON public.webhook_events(source, event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_next_retry ON public.webhook_events(next_retry_at) WHERE status = 'failed' AND retry_count < 5;
CREATE INDEX IF NOT EXISTS idx_webhook_events_processing_duration ON public.webhook_events(processing_duration_ms) WHERE processing_duration_ms IS NOT NULL;

-- Add comment for documentation
COMMENT ON TABLE public.webhook_events IS 'Stores all incoming webhook events from external services for idempotent processing';
COMMENT ON COLUMN public.webhook_events.event_id IS 'Provider-specific unique event identifier used for idempotency';
COMMENT ON COLUMN public.webhook_events.payload IS 'Complete webhook payload stored for reprocessing and debugging';
COMMENT ON CONSTRAINT webhook_events_idempotency_key ON public.webhook_events IS 'Ensures idempotent webhook processing - prevents duplicate event processing';

-- ============================================================================
-- STEP 4: Create webhook_processing_logs table for audit trail
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_processing_logs (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_event_id UUID NOT NULL REFERENCES public.webhook_events(id) ON DELETE CASCADE,

  -- Processing details
  action TEXT NOT NULL, -- e.g., 'create_subscription', 'update_user', 'send_email'
  action_status TEXT NOT NULL CHECK (action_status IN ('success', 'failed', 'skipped')),
  action_details JSONB, -- Specific details about what was done

  -- Performance tracking
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  duration_ms INTEGER GENERATED ALWAYS AS (
    EXTRACT(MILLISECOND FROM (completed_at - started_at)) +
    EXTRACT(SECOND FROM (completed_at - started_at)) * 1000
  ) STORED,

  -- Error tracking
  error_message TEXT,
  error_stack TEXT,

  -- Side effects tracking
  entities_affected JSONB, -- e.g., {"user_id": "...", "subscription_id": "..."}
  database_changes JSONB, -- Track what was inserted/updated
  external_calls JSONB, -- Track external API calls made

  -- Response tracking
  response_status_code INTEGER,
  response_body JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_webhook_processing_logs_event_id ON public.webhook_processing_logs(webhook_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_processing_logs_action ON public.webhook_processing_logs(action);
CREATE INDEX IF NOT EXISTS idx_webhook_processing_logs_created_at ON public.webhook_processing_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_processing_logs_duration ON public.webhook_processing_logs(duration_ms) WHERE duration_ms > 1000;

-- Add comments for documentation
COMMENT ON TABLE public.webhook_processing_logs IS 'Audit trail for all webhook processing actions';
COMMENT ON COLUMN public.webhook_processing_logs.entities_affected IS 'JSON object tracking all entities modified during processing';

-- ============================================================================
-- STEP 5: Create webhook_dlq (Dead Letter Queue) for failed events
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_dlq (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_event_id UUID UNIQUE NOT NULL REFERENCES public.webhook_events(id) ON DELETE CASCADE,

  -- Failure tracking
  final_error_message TEXT NOT NULL,
  final_error_details JSONB,
  total_attempts INTEGER NOT NULL,

  -- Resolution tracking
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,

  -- Timestamps
  moved_to_dlq_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for DLQ management
CREATE INDEX IF NOT EXISTS idx_webhook_dlq_resolved ON public.webhook_dlq(resolved) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_webhook_dlq_created_at ON public.webhook_dlq(created_at DESC);

-- Add comments
COMMENT ON TABLE public.webhook_dlq IS 'Dead letter queue for webhook events that failed processing after max retries';

-- ============================================================================
-- STEP 6: Create webhook_signatures table for signature verification
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_signatures (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Signature configuration
  source webhook_source NOT NULL UNIQUE,
  signing_secret TEXT NOT NULL, -- Encrypted in application
  endpoint_url TEXT NOT NULL,

  -- Verification settings
  header_name TEXT NOT NULL, -- e.g., 'Stripe-Signature', 'X-Revenuecat-Signature'
  algorithm TEXT NOT NULL, -- e.g., 'hmac-sha256'
  tolerance_seconds INTEGER DEFAULT 300, -- Timestamp tolerance for replay protection

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  rotated_at TIMESTAMPTZ,

  -- Metadata
  last_verified_at TIMESTAMPTZ,
  verification_count INTEGER DEFAULT 0
);

-- Add comment
COMMENT ON TABLE public.webhook_signatures IS 'Stores webhook signature verification configuration for each source';
COMMENT ON COLUMN public.webhook_signatures.signing_secret IS 'Encrypted webhook signing secret - should be encrypted at application layer';

-- ============================================================================
-- STEP 7: Create helper functions
-- ============================================================================

-- Function to check if an event has already been processed (idempotency check)
CREATE OR REPLACE FUNCTION public.is_webhook_processed(
  p_event_id TEXT,
  p_source webhook_source
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.webhook_events
    WHERE event_id = p_event_id
      AND source = p_source
      AND status IN ('completed', 'processing', 'skipped')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old webhook events
CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_events(
  p_days_to_keep INTEGER DEFAULT 90
) RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.webhook_events
  WHERE created_at < NOW() - INTERVAL '1 day' * p_days_to_keep
    AND status IN ('completed', 'skipped')
  RETURNING COUNT(*) INTO v_deleted_count;

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to move failed events to DLQ after max retries
CREATE OR REPLACE FUNCTION public.move_webhook_to_dlq(
  p_webhook_event_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_event RECORD;
BEGIN
  -- Get the event details
  SELECT * INTO v_event
  FROM public.webhook_events
  WHERE id = p_webhook_event_id
    AND status = 'failed'
    AND retry_count >= 5;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Insert into DLQ
  INSERT INTO public.webhook_dlq (
    webhook_event_id,
    final_error_message,
    final_error_details,
    total_attempts
  ) VALUES (
    p_webhook_event_id,
    v_event.error_message,
    v_event.error_details,
    v_event.retry_count + 1
  )
  ON CONFLICT (webhook_event_id) DO NOTHING;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 8: Create update trigger for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_webhook_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER webhook_events_updated_at
  BEFORE UPDATE ON public.webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_webhook_updated_at();

CREATE TRIGGER webhook_dlq_updated_at
  BEFORE UPDATE ON public.webhook_dlq
  FOR EACH ROW
  EXECUTE FUNCTION public.update_webhook_updated_at();

CREATE TRIGGER webhook_signatures_updated_at
  BEFORE UPDATE ON public.webhook_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_webhook_updated_at();

-- ============================================================================
-- STEP 9: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_processing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_dlq ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_signatures ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 10: Create RLS Policies
-- ============================================================================

-- webhook_events policies
-- Service role has full access
CREATE POLICY "Service role has full access to webhook_events"
  ON public.webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated admins can read webhook events
CREATE POLICY "Admins can read webhook_events"
  ON public.webhook_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.account_status = 'active'
    )
  );

-- webhook_processing_logs policies
-- Service role has full access
CREATE POLICY "Service role has full access to webhook_processing_logs"
  ON public.webhook_processing_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated admins can read processing logs
CREATE POLICY "Admins can read webhook_processing_logs"
  ON public.webhook_processing_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.account_status = 'active'
    )
  );

-- webhook_dlq policies
-- Service role has full access
CREATE POLICY "Service role has full access to webhook_dlq"
  ON public.webhook_dlq
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated admins can read and update DLQ (for resolution)
CREATE POLICY "Admins can read webhook_dlq"
  ON public.webhook_dlq
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.account_status = 'active'
    )
  );

CREATE POLICY "Admins can update webhook_dlq for resolution"
  ON public.webhook_dlq
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.account_status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.account_status = 'active'
    )
  );

-- webhook_signatures policies
-- Service role has full access
CREATE POLICY "Service role has full access to webhook_signatures"
  ON public.webhook_signatures
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- No authenticated user access to signatures (security sensitive)

-- ============================================================================
-- STEP 11: Create views for monitoring
-- ============================================================================

-- View for webhook processing metrics
CREATE OR REPLACE VIEW public.webhook_metrics AS
SELECT
  source,
  event_type,
  status,
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as event_count,
  AVG(processing_duration_ms) as avg_duration_ms,
  MAX(processing_duration_ms) as max_duration_ms,
  MIN(processing_duration_ms) as min_duration_ms,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failure_count,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success_count
FROM public.webhook_events
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY source, event_type, status, DATE_TRUNC('hour', created_at);

-- Grant permissions on view
GRANT SELECT ON public.webhook_metrics TO authenticated;

-- View for DLQ monitoring
CREATE OR REPLACE VIEW public.webhook_dlq_summary AS
SELECT
  we.source,
  we.event_type,
  COUNT(*) as dlq_count,
  SUM(CASE WHEN dlq.resolved THEN 1 ELSE 0 END) as resolved_count,
  SUM(CASE WHEN NOT dlq.resolved THEN 1 ELSE 0 END) as pending_count,
  MIN(dlq.moved_to_dlq_at) as oldest_event,
  MAX(dlq.moved_to_dlq_at) as newest_event
FROM public.webhook_dlq dlq
JOIN public.webhook_events we ON we.id = dlq.webhook_event_id
GROUP BY we.source, we.event_type;

-- Grant permissions on view
GRANT SELECT ON public.webhook_dlq_summary TO authenticated;

-- ============================================================================
-- STEP 12: Create indexes for common queries
-- ============================================================================

-- Index for finding events to retry
CREATE INDEX IF NOT EXISTS idx_webhook_events_retry_queue
ON public.webhook_events(next_retry_at, status)
WHERE status = 'failed' AND retry_count < 5 AND next_retry_at IS NOT NULL;

-- Index for finding processing timeouts
CREATE INDEX IF NOT EXISTS idx_webhook_events_processing_timeout
ON public.webhook_events(processing_started_at)
WHERE status = 'processing' AND processing_started_at < NOW() - INTERVAL '5 minutes';

-- Composite index for admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_webhook_events_dashboard
ON public.webhook_events(source, status, created_at DESC);

-- ============================================================================
-- Migration complete
-- ============================================================================

-- Add migration completion notice
DO $$
BEGIN
  RAISE NOTICE 'Webhook event tracking migration completed successfully';
  RAISE NOTICE 'Tables created: webhook_events, webhook_processing_logs, webhook_dlq, webhook_signatures';
  RAISE NOTICE 'RLS policies applied: Service role full access, Admin read access';
  RAISE NOTICE 'Idempotency enforced via unique constraint on (event_id, source)';
END $$;