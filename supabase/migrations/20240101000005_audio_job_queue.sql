-- Create audio_job_queue table for render job processing
CREATE TABLE IF NOT EXISTS audio_job_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0,
  stage VARCHAR(100),
  job_data JSONB NOT NULL,
  result JSONB,
  error TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add constraints
ALTER TABLE audio_job_queue 
  ADD CONSTRAINT chk_progress_range CHECK (progress >= 0 AND progress <= 100),
  ADD CONSTRAINT chk_status_valid CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'));

-- Create indexes for performance
CREATE INDEX idx_audio_job_queue_user_id ON audio_job_queue(user_id);
CREATE INDEX idx_audio_job_queue_track_id ON audio_job_queue(track_id);
CREATE INDEX idx_audio_job_queue_status ON audio_job_queue(status);
CREATE INDEX idx_audio_job_queue_created_at ON audio_job_queue(created_at DESC);
CREATE INDEX idx_audio_job_queue_user_status ON audio_job_queue(user_id, status);

-- Create composite index for queue processing (SKIP LOCKED pattern)
CREATE INDEX idx_audio_job_queue_processing ON audio_job_queue(status, created_at) WHERE status IN ('pending', 'processing');

-- Add RLS policies
ALTER TABLE audio_job_queue ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own render jobs
CREATE POLICY "Users can view own render jobs" ON audio_job_queue
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Users can only create render jobs for their own tracks
CREATE POLICY "Users can create render jobs for own tracks" ON audio_job_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM tracks 
      WHERE tracks.id = track_id AND tracks.user_id = auth.uid()
    )
  );

-- Policy: Users can only update their own render jobs
CREATE POLICY "Users can update own render jobs" ON audio_job_queue
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Service role can manage all jobs (for Edge Functions)
CREATE POLICY "Service role full access" ON audio_job_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_audio_job_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER trigger_audio_job_queue_updated_at
  BEFORE UPDATE ON audio_job_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_audio_job_queue_updated_at();

-- Create function to increment download count for tracks
CREATE OR REPLACE FUNCTION increment_download_count(track_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE tracks 
  SET 
    play_count = COALESCE(play_count, 0) + 1,
    updated_at = NOW()
  WHERE id = track_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_download_count(UUID) TO authenticated;

-- Create function for queue processing (SKIP LOCKED pattern)
CREATE OR REPLACE FUNCTION get_next_pending_job()
RETURNS TABLE (
  job_id UUID,
  track_id UUID,
  user_id UUID,
  job_data JSONB
) AS $$
BEGIN
  RETURN QUERY
  UPDATE audio_job_queue
  SET 
    status = 'processing',
    started_at = NOW(),
    updated_at = NOW()
  WHERE id = (
    SELECT audio_job_queue.id
    FROM audio_job_queue
    WHERE status = 'pending'
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING audio_job_queue.id, audio_job_queue.track_id, audio_job_queue.user_id, audio_job_queue.job_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION get_next_pending_job() TO service_role;

-- Create function to update job progress
CREATE OR REPLACE FUNCTION update_job_progress(
  job_id UUID,
  new_progress INTEGER,
  new_stage TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE audio_job_queue
  SET 
    progress = new_progress,
    stage = COALESCE(new_stage, stage),
    updated_at = NOW()
  WHERE id = job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION update_job_progress(UUID, INTEGER, TEXT) TO service_role;

-- Create function to complete job
CREATE OR REPLACE FUNCTION complete_job(
  job_id UUID,
  job_result JSONB DEFAULT NULL,
  job_error TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE audio_job_queue
  SET 
    status = CASE 
      WHEN job_error IS NOT NULL THEN 'failed'
      ELSE 'completed'
    END,
    progress = CASE 
      WHEN job_error IS NOT NULL THEN progress
      ELSE 100
    END,
    result = job_result,
    error = job_error,
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION complete_job(UUID, JSONB, TEXT) TO service_role;

-- Add comments for documentation
COMMENT ON TABLE audio_job_queue IS 'Queue for audio rendering jobs with progress tracking';
COMMENT ON COLUMN audio_job_queue.status IS 'Job status: pending, processing, completed, failed, cancelled';
COMMENT ON COLUMN audio_job_queue.progress IS 'Progress percentage (0-100)';
COMMENT ON COLUMN audio_job_queue.stage IS 'Current processing stage description';
COMMENT ON COLUMN audio_job_queue.job_data IS 'Job configuration and parameters';
COMMENT ON COLUMN audio_job_queue.result IS 'Job result data including URLs and metadata';
COMMENT ON FUNCTION get_next_pending_job() IS 'Atomically gets next pending job using SKIP LOCKED pattern';
COMMENT ON FUNCTION update_job_progress(UUID, INTEGER, TEXT) IS 'Updates job progress and stage';
COMMENT ON FUNCTION complete_job(UUID, JSONB, TEXT) IS 'Marks job as completed or failed with result/error';