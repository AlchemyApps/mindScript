-- Create generic job queue system for handling various background tasks
-- This supports email, analytics, payouts, and other async processing

-- Create job types enum
CREATE TYPE job_type AS ENUM (
  'email',
  'audio_render',
  'payout',
  'analytics',
  'notification',
  'data_export',
  'cleanup'
);

-- Create job status enum
CREATE TYPE job_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'retry',
  'dead_letter'
);

-- Create job priority enum
CREATE TYPE job_priority AS ENUM (
  'low',
  'normal',
  'high',
  'critical'
);

-- Create main job queue table
CREATE TABLE IF NOT EXISTS job_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type job_type NOT NULL,
  status job_status NOT NULL DEFAULT 'pending',
  priority job_priority NOT NULL DEFAULT 'normal',

  -- Job payload and metadata
  payload JSONB NOT NULL,
  result JSONB,
  error TEXT,

  -- Retry management
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  retry_delay_seconds INTEGER NOT NULL DEFAULT 60,
  next_retry_at TIMESTAMP WITH TIME ZONE,

  -- Scheduling
  scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Progress tracking
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  stage VARCHAR(255),

  -- Dependencies
  depends_on UUID REFERENCES job_queue(id) ON DELETE SET NULL,

  -- Rate limiting
  rate_limit_key VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- User association (optional)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for efficient queue processing
CREATE INDEX idx_job_queue_pending ON job_queue(type, status, priority DESC, scheduled_for ASC)
  WHERE status IN ('pending', 'retry');

CREATE INDEX idx_job_queue_processing ON job_queue(type, status, started_at)
  WHERE status = 'processing';

CREATE INDEX idx_job_queue_scheduled ON job_queue(scheduled_for)
  WHERE status = 'pending' AND scheduled_for > NOW();

CREATE INDEX idx_job_queue_retry ON job_queue(next_retry_at)
  WHERE status = 'retry';

CREATE INDEX idx_job_queue_user ON job_queue(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX idx_job_queue_dependencies ON job_queue(depends_on)
  WHERE depends_on IS NOT NULL;

CREATE INDEX idx_job_queue_rate_limit ON job_queue(rate_limit_key, status, created_at)
  WHERE rate_limit_key IS NOT NULL;

-- Create dead letter queue for failed jobs
CREATE TABLE IF NOT EXISTS job_dead_letter (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_job_id UUID NOT NULL,
  type job_type NOT NULL,
  payload JSONB NOT NULL,
  error TEXT,
  retry_count INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_job_dead_letter_type ON job_dead_letter(type);
CREATE INDEX idx_job_dead_letter_created ON job_dead_letter(created_at DESC);

-- Create job status history table for auditing
CREATE TABLE IF NOT EXISTS job_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES job_queue(id) ON DELETE CASCADE,
  old_status job_status,
  new_status job_status NOT NULL,
  error TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_job_status_history_job ON job_status_history(job_id);
CREATE INDEX idx_job_status_history_created ON job_status_history(created_at DESC);

-- Enable RLS
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_dead_letter ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for job_queue
CREATE POLICY "Users can view their own jobs" ON job_queue
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Service role full access" ON job_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for job_dead_letter
CREATE POLICY "Service role can manage dead letter" ON job_dead_letter
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for job_status_history
CREATE POLICY "Service role can manage history" ON job_status_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to get next job with SKIP LOCKED pattern
CREATE OR REPLACE FUNCTION get_next_job(
  p_type job_type DEFAULT NULL,
  p_batch_size INTEGER DEFAULT 1
)
RETURNS TABLE (
  job_id UUID,
  job_type job_type,
  job_payload JSONB,
  job_metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH selected_jobs AS (
    SELECT jq.id
    FROM job_queue jq
    WHERE
      (p_type IS NULL OR jq.type = p_type)
      AND jq.status IN ('pending', 'retry')
      AND jq.scheduled_for <= NOW()
      AND (jq.next_retry_at IS NULL OR jq.next_retry_at <= NOW())
      AND (jq.depends_on IS NULL OR EXISTS (
        SELECT 1 FROM job_queue dep
        WHERE dep.id = jq.depends_on AND dep.status = 'completed'
      ))
    ORDER BY
      CASE jq.priority
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
      END,
      jq.scheduled_for ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_batch_size
  )
  UPDATE job_queue
  SET
    status = 'processing',
    started_at = NOW(),
    updated_at = NOW()
  WHERE id IN (SELECT selected_jobs.id FROM selected_jobs)
  RETURNING
    job_queue.id AS job_id,
    job_queue.type AS job_type,
    job_queue.payload AS job_payload,
    job_queue.metadata AS job_metadata;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update job progress
CREATE OR REPLACE FUNCTION update_job_progress(
  p_job_id UUID,
  p_progress INTEGER,
  p_stage TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE job_queue
  SET
    progress = p_progress,
    stage = COALESCE(p_stage, stage),
    updated_at = NOW()
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete a job
CREATE OR REPLACE FUNCTION complete_job(
  p_job_id UUID,
  p_result JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Update job status
  UPDATE job_queue
  SET
    status = 'completed',
    progress = 100,
    result = p_result,
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_job_id;

  -- Log status change
  INSERT INTO job_status_history (job_id, old_status, new_status, metadata)
  SELECT
    p_job_id,
    'processing',
    'completed',
    p_result
  FROM job_queue WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to fail a job with retry logic
CREATE OR REPLACE FUNCTION fail_job(
  p_job_id UUID,
  p_error TEXT,
  p_retry BOOLEAN DEFAULT TRUE
)
RETURNS VOID AS $$
DECLARE
  v_job RECORD;
  v_new_status job_status;
BEGIN
  -- Get current job details
  SELECT * INTO v_job FROM job_queue WHERE id = p_job_id;

  -- Determine new status based on retry logic
  IF p_retry AND v_job.retry_count < v_job.max_retries THEN
    v_new_status := 'retry';

    -- Calculate exponential backoff for next retry
    UPDATE job_queue
    SET
      status = v_new_status,
      error = p_error,
      retry_count = retry_count + 1,
      next_retry_at = NOW() + INTERVAL '1 second' * (retry_delay_seconds * POWER(2, retry_count)),
      updated_at = NOW()
    WHERE id = p_job_id;
  ELSE
    v_new_status := 'failed';

    -- Mark as failed and move to dead letter if max retries exceeded
    UPDATE job_queue
    SET
      status = v_new_status,
      error = p_error,
      completed_at = NOW(),
      updated_at = NOW()
    WHERE id = p_job_id;

    -- Add to dead letter queue
    IF v_job.retry_count >= v_job.max_retries THEN
      INSERT INTO job_dead_letter (
        original_job_id,
        type,
        payload,
        error,
        retry_count,
        metadata
      )
      VALUES (
        p_job_id,
        v_job.type,
        v_job.payload,
        p_error,
        v_job.retry_count,
        v_job.metadata
      );

      -- Update status to dead_letter
      UPDATE job_queue SET status = 'dead_letter' WHERE id = p_job_id;
      v_new_status := 'dead_letter';
    END IF;
  END IF;

  -- Log status change
  INSERT INTO job_status_history (job_id, old_status, new_status, error)
  VALUES (p_job_id, v_job.status, v_new_status, p_error);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up stuck jobs
CREATE OR REPLACE FUNCTION cleanup_stuck_jobs(
  p_timeout_minutes INTEGER DEFAULT 10
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH stuck_jobs AS (
    UPDATE job_queue
    SET
      status = 'retry',
      updated_at = NOW()
    WHERE
      status = 'processing'
      AND started_at < NOW() - INTERVAL '1 minute' * p_timeout_minutes
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM stuck_jobs;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key VARCHAR(255),
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM job_queue
  WHERE
    rate_limit_key = p_key
    AND created_at > NOW() - INTERVAL '1 second' * p_window_seconds
    AND status IN ('pending', 'processing', 'retry');

  RETURN v_count < p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to enqueue a job
CREATE OR REPLACE FUNCTION enqueue_job(
  p_type job_type,
  p_payload JSONB,
  p_priority job_priority DEFAULT 'normal',
  p_scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  p_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_depends_on UUID DEFAULT NULL,
  p_rate_limit_key VARCHAR(255) DEFAULT NULL,
  p_max_retries INTEGER DEFAULT 3
)
RETURNS UUID AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- Check rate limit if applicable
  IF p_rate_limit_key IS NOT NULL THEN
    -- Default rate limit: 100 jobs per minute
    IF NOT check_rate_limit(p_rate_limit_key, 100, 60) THEN
      RAISE EXCEPTION 'Rate limit exceeded for key: %', p_rate_limit_key;
    END IF;
  END IF;

  -- Insert the job
  INSERT INTO job_queue (
    type,
    payload,
    priority,
    scheduled_for,
    user_id,
    metadata,
    depends_on,
    rate_limit_key,
    max_retries
  ) VALUES (
    p_type,
    p_payload,
    p_priority,
    p_scheduled_for,
    p_user_id,
    p_metadata,
    p_depends_on,
    p_rate_limit_key,
    p_max_retries
  ) RETURNING id INTO v_job_id;

  -- Log creation
  INSERT INTO job_status_history (job_id, new_status)
  VALUES (v_job_id, 'pending');

  RETURN v_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_next_job(job_type, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION update_job_progress(UUID, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION complete_job(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION fail_job(UUID, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_stuck_jobs(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION check_rate_limit(VARCHAR, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION enqueue_job(job_type, JSONB, job_priority, TIMESTAMP WITH TIME ZONE, UUID, JSONB, UUID, VARCHAR, INTEGER) TO authenticated, service_role;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_job_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_job_queue_updated_at
  BEFORE UPDATE ON job_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_job_queue_updated_at();

-- Add comments for documentation
COMMENT ON TABLE job_queue IS 'Generic job queue for background processing with retry and rate limiting';
COMMENT ON TABLE job_dead_letter IS 'Failed jobs that exceeded retry limits';
COMMENT ON TABLE job_status_history IS 'Audit log of job status changes';
COMMENT ON FUNCTION get_next_job IS 'Atomically get next job(s) using SKIP LOCKED pattern';
COMMENT ON FUNCTION enqueue_job IS 'Add a new job to the queue with optional scheduling and dependencies';
COMMENT ON FUNCTION fail_job IS 'Mark job as failed with automatic retry logic and dead letter queue';