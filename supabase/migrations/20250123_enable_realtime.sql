-- Enable Realtime for audio_job_queue table
-- This allows clients to subscribe to changes for render progress updates

-- First, ensure the publication exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END
$$;

-- Enable realtime for the audio_job_queue table
ALTER PUBLICATION supabase_realtime ADD TABLE audio_job_queue;

-- Create index for efficient realtime queries on job updates
CREATE INDEX IF NOT EXISTS idx_audio_job_queue_realtime
ON audio_job_queue(id, status, progress, stage)
WHERE status IN ('pending', 'processing');

-- Add comment for documentation
COMMENT ON INDEX idx_audio_job_queue_realtime IS 'Optimized index for realtime subscriptions to track job progress';