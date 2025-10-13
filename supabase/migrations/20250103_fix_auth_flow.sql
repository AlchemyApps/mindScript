-- Migration: Fix Authentication Flow
-- Description: Add tables and constraints needed for the new server-side auth flow
-- Date: 2025-01-03

-- Create pending_tracks table for temporary storage of track configs during auth
CREATE TABLE IF NOT EXISTS pending_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  track_config JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Add index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_pending_tracks_expires_at ON pending_tracks(expires_at);
CREATE INDEX IF NOT EXISTS idx_pending_tracks_email ON pending_tracks(user_email);

-- Add unique constraint on purchases.checkout_session_id for idempotency
ALTER TABLE purchases
ADD COLUMN IF NOT EXISTS checkout_session_id TEXT;

-- Create unique index if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'purchases_checkout_session_id_key'
  ) THEN
    CREATE UNIQUE INDEX purchases_checkout_session_id_key
    ON purchases(checkout_session_id)
    WHERE checkout_session_id IS NOT NULL;
  END IF;
END $$;

-- Update purchases table structure if needed
ALTER TABLE purchases
ADD COLUMN IF NOT EXISTS amount BIGINT,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'usd',
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS track_id UUID REFERENCES tracks(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create webhook_events table if not exists (for idempotency)
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for event lookups
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);

-- Update profiles table to track first purchase discount
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS first_track_discount_used BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create or update audio_job_queue table
CREATE TABLE IF NOT EXISTS audio_job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID REFERENCES tracks(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  job_data JSONB NOT NULL,
  priority INTEGER DEFAULT 0,
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Add indexes for job queue
CREATE INDEX IF NOT EXISTS idx_audio_job_queue_status ON audio_job_queue(status);
CREATE INDEX IF NOT EXISTS idx_audio_job_queue_priority ON audio_job_queue(priority DESC);
CREATE INDEX IF NOT EXISTS idx_audio_job_queue_created_at ON audio_job_queue(created_at);

-- Create track_access table if not exists
CREATE TABLE IF NOT EXISTS track_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  track_id UUID REFERENCES tracks(id) NOT NULL,
  access_type TEXT NOT NULL DEFAULT 'owned',
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id, track_id)
);

-- RLS Policies for pending_tracks
ALTER TABLE pending_tracks ENABLE ROW LEVEL SECURITY;

-- Anyone can insert pending tracks (for guest users)
CREATE POLICY "pending_tracks_insert_policy" ON pending_tracks
  FOR INSERT
  WITH CHECK (true);

-- Service role can manage all pending tracks
CREATE POLICY "pending_tracks_service_role_policy" ON pending_tracks
  FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies for webhook_events
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service role can access webhook events
CREATE POLICY "webhook_events_service_role_policy" ON webhook_events
  FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies for audio_job_queue
ALTER TABLE audio_job_queue ENABLE ROW LEVEL SECURITY;

-- Users can see their own jobs
CREATE POLICY "audio_job_queue_select_policy" ON audio_job_queue
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all jobs
CREATE POLICY "audio_job_queue_service_role_policy" ON audio_job_queue
  FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies for track_access
ALTER TABLE track_access ENABLE ROW LEVEL SECURITY;

-- Users can see their own track access
CREATE POLICY "track_access_select_policy" ON track_access
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all access
CREATE POLICY "track_access_service_role_policy" ON track_access
  FOR ALL
  USING (auth.role() = 'service_role');

-- Function to clean up expired pending tracks
CREATE OR REPLACE FUNCTION cleanup_expired_pending_tracks()
RETURNS void AS $$
BEGIN
  DELETE FROM pending_tracks
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up expired pending tracks (if using pg_cron)
-- This would need to be set up separately in Supabase dashboard or via pg_cron extension
-- Example: SELECT cron.schedule('cleanup-pending-tracks', '0 * * * *', 'SELECT cleanup_expired_pending_tracks();');

-- Add comment for documentation
COMMENT ON TABLE pending_tracks IS 'Temporary storage for track configurations during the authentication flow';
COMMENT ON TABLE webhook_events IS 'Idempotency tracking for webhook events from external services';
COMMENT ON COLUMN purchases.checkout_session_id IS 'Stripe checkout session ID for idempotent webhook processing';