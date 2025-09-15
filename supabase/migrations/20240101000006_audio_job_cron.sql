-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Create storage buckets for audio processing
INSERT INTO storage.buckets (id, name, public, avif_autodetection, allowed_mime_types)
VALUES
  ('audio-renders', 'audio-renders', false, false, ARRAY['audio/mpeg', 'audio/wav', 'audio/mp3']::text[]),
  ('background-music', 'background-music', true, false, ARRAY['audio/mpeg', 'audio/wav', 'audio/mp3']::text[])
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for audio-renders bucket
CREATE POLICY "Users can upload own renders" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'audio-renders' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view own renders" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'audio-renders' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Service role can manage all renders" ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'audio-renders')
  WITH CHECK (bucket_id = 'audio-renders');

-- Create RLS policies for background-music bucket (public read)
CREATE POLICY "Anyone can view background music" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'background-music');

CREATE POLICY "Service role can manage background music" ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'background-music')
  WITH CHECK (bucket_id = 'background-music');

-- Create function to trigger audio processor worker
CREATE OR REPLACE FUNCTION trigger_audio_processor_worker()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  worker_url text;
  service_key text;
  response_status int;
BEGIN
  -- Get the function URL and service key from vault
  SELECT current_setting('app.supabase_url') || '/functions/v1/audio-processor-worker' INTO worker_url;
  SELECT current_setting('app.supabase_service_role_key') INTO service_key;

  -- Make HTTP request to trigger the worker
  -- Note: In production, you'd use pg_net or http extension
  -- For now, we'll just log that it should be triggered
  RAISE NOTICE 'Audio processor worker should be triggered at: %', worker_url;

  -- Alternative: Use pg_net if available
  -- PERFORM net.http_post(
  --   url := worker_url,
  --   headers := jsonb_build_object('Authorization', 'Bearer ' || service_key),
  --   body := jsonb_build_object('action', 'process')
  -- );
END;
$$;

-- Schedule the audio processor worker to run every minute
SELECT cron.schedule(
  'process-audio-jobs',
  '* * * * *', -- Every minute
  $$SELECT trigger_audio_processor_worker();$$
);

-- Create function to send completion notification
CREATE OR REPLACE FUNCTION send_render_completion_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Only send notification when job completes successfully
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Insert notification record (would integrate with Resend in Edge Function)
    INSERT INTO notifications_queue (
      user_id,
      type,
      data,
      created_at
    ) VALUES (
      NEW.user_id,
      'render_complete',
      jsonb_build_object(
        'job_id', NEW.id,
        'track_id', NEW.track_id,
        'result', NEW.result
      ),
      NOW()
    );
  END IF;

  -- Send failure notification
  IF NEW.status = 'failed' AND OLD.status != 'failed' THEN
    INSERT INTO notifications_queue (
      user_id,
      type,
      data,
      created_at
    ) VALUES (
      NEW.user_id,
      'render_failed',
      jsonb_build_object(
        'job_id', NEW.id,
        'track_id', NEW.track_id,
        'error', NEW.error
      ),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create notifications queue table
CREATE TABLE IF NOT EXISTS notifications_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  data JSONB,
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for processing
CREATE INDEX idx_notifications_queue_pending ON notifications_queue(sent, created_at) WHERE sent = FALSE;

-- Create trigger for notifications
CREATE TRIGGER trigger_render_notification
  AFTER UPDATE ON audio_job_queue
  FOR EACH ROW
  EXECUTE FUNCTION send_render_completion_notification();

-- Add comments
COMMENT ON FUNCTION trigger_audio_processor_worker() IS 'Triggers the Edge Function worker to process audio jobs';
COMMENT ON TABLE notifications_queue IS 'Queue for email notifications via Resend';
COMMENT ON TRIGGER trigger_render_notification ON audio_job_queue IS 'Sends notifications when render jobs complete or fail';