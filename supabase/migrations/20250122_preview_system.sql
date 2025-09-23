-- Add preview_url column to tracks table
ALTER TABLE public.tracks
ADD COLUMN IF NOT EXISTS preview_url TEXT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_tracks_preview_url ON public.tracks (preview_url) WHERE preview_url IS NOT NULL;

-- Create storage bucket for track previews (public access)
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'track-previews',
  'track-previews',
  true, -- Public bucket for preview access
  false,
  5242880, -- 5MB limit (previews should be small)
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav']::text[]
) ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav']::text[];

-- RLS policies for track-previews bucket
-- Anyone can read (public previews)
CREATE POLICY "Public read access for track previews"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'track-previews');

-- Only service role can upload/modify previews
CREATE POLICY "Service role insert for track previews"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'track-previews');

CREATE POLICY "Service role update for track previews"
ON storage.objects
FOR UPDATE
TO service_role
USING (bucket_id = 'track-previews');

CREATE POLICY "Service role delete for track previews"
ON storage.objects
FOR DELETE
TO service_role
USING (bucket_id = 'track-previews');

-- Create function to update track with preview URL
CREATE OR REPLACE FUNCTION update_track_preview_url(
  p_track_id UUID,
  p_preview_url TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.tracks
  SET
    preview_url = p_preview_url,
    updated_at = NOW()
  WHERE id = p_track_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role only
GRANT EXECUTE ON FUNCTION update_track_preview_url(UUID, TEXT) TO service_role;

-- Update completeJob function to handle preview_url
CREATE OR REPLACE FUNCTION public.complete_job(
  job_id UUID,
  job_result JSONB DEFAULT NULL,
  job_error TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_track_id UUID;
  v_audio_url TEXT;
  v_preview_url TEXT;
BEGIN
  -- Get track_id from job
  SELECT track_id INTO v_track_id
  FROM public.audio_job_queue
  WHERE id = job_id;

  -- Update job status
  UPDATE public.audio_job_queue
  SET
    status = CASE
      WHEN job_error IS NOT NULL THEN 'failed'::job_status
      ELSE 'completed'::job_status
    END,
    error = job_error,
    result = job_result,
    completed_at = CASE
      WHEN job_error IS NULL THEN NOW()
      ELSE NULL
    END,
    updated_at = NOW()
  WHERE id = job_id;

  -- If job succeeded and has audio URL, update track
  IF job_error IS NULL AND job_result IS NOT NULL THEN
    v_audio_url := job_result->>'url';
    v_preview_url := job_result->>'preview_url';

    IF v_audio_url IS NOT NULL AND v_track_id IS NOT NULL THEN
      UPDATE public.tracks
      SET
        audio_url = v_audio_url,
        preview_url = v_preview_url,
        status = 'completed'::track_status,
        duration = COALESCE((job_result->>'duration')::INT, 0),
        file_size = COALESCE((job_result->>'size')::BIGINT, 0),
        updated_at = NOW()
      WHERE id = v_track_id;
    END IF;
  END IF;

  -- If job failed, update track status to failed
  IF job_error IS NOT NULL AND v_track_id IS NOT NULL THEN
    UPDATE public.tracks
    SET
      status = 'failed'::track_status,
      updated_at = NOW()
    WHERE id = v_track_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON COLUMN public.tracks.preview_url IS 'Public URL for 15-second preview clip';