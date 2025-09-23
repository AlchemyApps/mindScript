-- ============================================================================
-- MindScript Track Storage Management System
-- ============================================================================
-- This migration creates comprehensive storage buckets for audio file management
-- with granular access control policies and automatic cleanup mechanisms.
--
-- Buckets:
-- 1. tracks-private: Full audio files (authenticated access only)
-- 2. tracks-public: Preview clips (public access)
-- 3. tracks-temp: Processing files (service role only, 24h TTL)
-- ============================================================================

-- ============================================================================
-- 1. PRIVATE TRACKS BUCKET (Full Audio Files)
-- ============================================================================
-- This bucket stores the complete audio files that users purchase
-- Access is restricted to: track owner, purchasers, and admin roles

INSERT INTO storage.buckets (
  id,
  name,
  public,
  avif_autodetection,
  file_size_limit,
  allowed_mime_types,
  created_at,
  updated_at
)
VALUES (
  'tracks-private',
  'tracks-private',
  false, -- Private bucket - requires authentication
  false, -- No image optimization needed
  524288000, -- 500MB limit for full audio files
  ARRAY[
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/wav',
    'audio/x-wav',
    'audio/flac',
    'audio/aac',
    'audio/ogg',
    'audio/webm'
  ]::text[],
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 524288000,
  allowed_mime_types = ARRAY[
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/wav',
    'audio/x-wav',
    'audio/flac',
    'audio/aac',
    'audio/ogg',
    'audio/webm'
  ]::text[],
  updated_at = NOW();

-- ============================================================================
-- 2. PUBLIC TRACKS BUCKET (Preview Clips)
-- ============================================================================
-- This bucket stores 15-30 second preview clips
-- Anyone can access these for discovery purposes

INSERT INTO storage.buckets (
  id,
  name,
  public,
  avif_autodetection,
  file_size_limit,
  allowed_mime_types,
  created_at,
  updated_at
)
VALUES (
  'tracks-public',
  'tracks-public',
  true, -- Public bucket for preview access
  false,
  10485760, -- 10MB limit (previews should be smaller)
  ARRAY[
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/wav',
    'audio/ogg',
    'audio/webm'
  ]::text[],
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/wav',
    'audio/ogg',
    'audio/webm'
  ]::text[],
  updated_at = NOW();

-- ============================================================================
-- 3. TEMPORARY PROCESSING BUCKET
-- ============================================================================
-- This bucket stores files during audio processing
-- Only service role can access, files auto-delete after 24 hours

INSERT INTO storage.buckets (
  id,
  name,
  public,
  avif_autodetection,
  file_size_limit,
  allowed_mime_types,
  created_at,
  updated_at
)
VALUES (
  'tracks-temp',
  'tracks-temp',
  false, -- Private bucket - service role only
  false,
  1073741824, -- 1GB limit for processing large files
  ARRAY[
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/wav',
    'audio/x-wav',
    'audio/flac',
    'audio/aac',
    'audio/ogg',
    'audio/webm',
    'application/octet-stream' -- Allow raw audio data
  ]::text[],
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 1073741824,
  allowed_mime_types = ARRAY[
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/wav',
    'audio/x-wav',
    'audio/flac',
    'audio/aac',
    'audio/ogg',
    'audio/webm',
    'application/octet-stream'
  ]::text[],
  updated_at = NOW();

-- ============================================================================
-- RLS POLICIES FOR PRIVATE TRACKS BUCKET
-- ============================================================================

-- Policy: Track owners can read their own files
CREATE POLICY "Track owners can read their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'tracks-private'
  AND (
    -- Check if user owns the track
    EXISTS (
      SELECT 1 FROM public.tracks t
      WHERE t.creator_id = auth.uid()
      AND (
        -- Match the audio_url path structure
        storage.objects.name = SUBSTRING(t.audio_url FROM 'tracks-private/(.*)$')
        OR
        -- Match the path pattern: {user_id}/{year}/{month}/{track_id}/
        storage.objects.name LIKE auth.uid()::text || '/%/' || t.id::text || '/%'
      )
    )
  )
);

-- Policy: Users who purchased can read the track
CREATE POLICY "Purchasers can read purchased tracks"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'tracks-private'
  AND EXISTS (
    SELECT 1 FROM public.purchases p
    INNER JOIN public.tracks t ON t.id = p.track_id
    WHERE p.user_id = auth.uid()
    AND p.status = 'completed'
    AND (
      storage.objects.name = SUBSTRING(t.audio_url FROM 'tracks-private/(.*)$')
      OR
      storage.objects.name LIKE '%/' || t.id::text || '/%'
    )
  )
);

-- Policy: Track owners can upload/update their files
CREATE POLICY "Track owners can upload their files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tracks-private'
  AND (
    -- Must follow the path structure: {user_id}/{year}/{month}/{track_id}/{filename}
    storage.objects.name ~ ('^' || auth.uid()::text || '/\d{4}/\d{2}/[a-f0-9\-]{36}/.+$')
  )
);

-- Policy: Track owners can update their files
CREATE POLICY "Track owners can update their files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tracks-private'
  AND storage.objects.owner = auth.uid()
  AND storage.objects.name ~ ('^' || auth.uid()::text || '/')
);

-- Policy: Track owners can delete their files
CREATE POLICY "Track owners can delete their files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'tracks-private'
  AND storage.objects.owner = auth.uid()
  AND storage.objects.name ~ ('^' || auth.uid()::text || '/')
);

-- Policy: Service role has full access to private tracks
CREATE POLICY "Service role full access to private tracks"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'tracks-private')
WITH CHECK (bucket_id = 'tracks-private');

-- ============================================================================
-- RLS POLICIES FOR PUBLIC TRACKS BUCKET
-- ============================================================================

-- Policy: Anyone can read public previews
CREATE POLICY "Public read access for track previews"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'tracks-public');

-- Policy: Authenticated users can upload their own previews
CREATE POLICY "Users can upload their own previews"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tracks-public'
  AND storage.objects.name ~ ('^' || auth.uid()::text || '/\d{4}/\d{2}/[a-f0-9\-]{36}/.+$')
);

-- Policy: Track owners can update their previews
CREATE POLICY "Track owners can update their previews"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tracks-public'
  AND storage.objects.owner = auth.uid()
  AND storage.objects.name ~ ('^' || auth.uid()::text || '/')
);

-- Policy: Track owners can delete their previews
CREATE POLICY "Track owners can delete their previews"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'tracks-public'
  AND storage.objects.owner = auth.uid()
  AND storage.objects.name ~ ('^' || auth.uid()::text || '/')
);

-- Policy: Service role full access to public tracks
CREATE POLICY "Service role full access to public tracks"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'tracks-public')
WITH CHECK (bucket_id = 'tracks-public');

-- ============================================================================
-- RLS POLICIES FOR TEMP BUCKET (Service Role Only)
-- ============================================================================

-- Policy: Only service role can access temp bucket
CREATE POLICY "Service role exclusive access to temp bucket"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'tracks-temp')
WITH CHECK (bucket_id = 'tracks-temp');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Generate storage path for a track
CREATE OR REPLACE FUNCTION public.generate_storage_path(
  p_user_id UUID,
  p_track_id UUID,
  p_filename TEXT,
  p_bucket_type TEXT DEFAULT 'private' -- 'private', 'public', or 'temp'
)
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_month TEXT;
  v_bucket_prefix TEXT;
BEGIN
  -- Get current year and month
  v_year := TO_CHAR(NOW(), 'YYYY');
  v_month := TO_CHAR(NOW(), 'MM');

  -- Determine bucket prefix
  v_bucket_prefix := CASE p_bucket_type
    WHEN 'private' THEN 'tracks-private'
    WHEN 'public' THEN 'tracks-public'
    WHEN 'temp' THEN 'tracks-temp'
    ELSE 'tracks-private'
  END;

  -- Return the full path
  -- Format: {bucket}/{user_id}/{year}/{month}/{track_id}/{filename}
  RETURN v_bucket_prefix || '/' ||
         p_user_id::text || '/' ||
         v_year || '/' ||
         v_month || '/' ||
         p_track_id::text || '/' ||
         p_filename;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Clean up old temp files (to be called by a cron job)
CREATE OR REPLACE FUNCTION public.cleanup_temp_storage()
RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete files older than 24 hours from temp bucket
  WITH deleted AS (
    DELETE FROM storage.objects
    WHERE bucket_id = 'tracks-temp'
    AND created_at < NOW() - INTERVAL '24 hours'
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO v_deleted_count FROM deleted;

  -- Log the cleanup
  RAISE NOTICE 'Cleaned up % temp files older than 24 hours', v_deleted_count;

  RETURN QUERY SELECT v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role for cleanup function
GRANT EXECUTE ON FUNCTION public.cleanup_temp_storage() TO service_role;

-- Function: Get signed URL for private track (with expiry)
CREATE OR REPLACE FUNCTION public.get_track_signed_url(
  p_track_id UUID,
  p_expires_in INTEGER DEFAULT 3600 -- 1 hour default
)
RETURNS TEXT AS $$
DECLARE
  v_track_owner UUID;
  v_audio_path TEXT;
  v_has_access BOOLEAN;
BEGIN
  -- Get track details
  SELECT creator_id,
         SUBSTRING(audio_url FROM 'tracks-private/(.*)$')
  INTO v_track_owner, v_audio_path
  FROM public.tracks
  WHERE id = p_track_id;

  -- Check if user has access (owner or purchaser)
  v_has_access := (
    auth.uid() = v_track_owner
    OR EXISTS (
      SELECT 1 FROM public.purchases
      WHERE track_id = p_track_id
      AND user_id = auth.uid()
      AND status = 'completed'
    )
  );

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Access denied to track %', p_track_id;
  END IF;

  -- Note: Actual signed URL generation would be done in application code
  -- This function just validates access and returns the path
  RETURN v_audio_path;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_track_signed_url(UUID, INTEGER) TO authenticated;

-- ============================================================================
-- STORAGE METRICS AND MONITORING
-- ============================================================================

-- View: Storage usage by user
CREATE OR REPLACE VIEW public.user_storage_usage AS
SELECT
  o.owner AS user_id,
  o.bucket_id,
  COUNT(*) AS file_count,
  SUM(o.metadata->>'size')::BIGINT AS total_bytes,
  ROUND(SUM(o.metadata->>'size')::NUMERIC / 1048576, 2) AS total_mb,
  MAX(o.created_at) AS last_upload
FROM storage.objects o
WHERE o.bucket_id IN ('tracks-private', 'tracks-public', 'tracks-temp')
GROUP BY o.owner, o.bucket_id;

-- Grant select permission on the view
GRANT SELECT ON public.user_storage_usage TO authenticated;

-- ============================================================================
-- CORS CONFIGURATION
-- ============================================================================
-- Note: CORS is typically configured at the application level (Supabase Dashboard)
-- These are the recommended settings:
--
-- For tracks-private bucket:
-- - Allowed origins: Your application domains only
-- - Allowed methods: GET, POST, PUT, DELETE
-- - Allowed headers: authorization, x-client-info, apikey, content-type, range
-- - Exposed headers: content-range, content-length, content-type
-- - Max age: 3600
--
-- For tracks-public bucket:
-- - Allowed origins: * (public access)
-- - Allowed methods: GET, HEAD
-- - Allowed headers: range, content-type
-- - Exposed headers: content-range, content-length, content-type
-- - Max age: 86400
--
-- For tracks-temp bucket:
-- - Allowed origins: Your server/service domains only
-- - Allowed methods: GET, POST, PUT, DELETE
-- - Allowed headers: authorization, x-client-info, apikey, content-type
-- - Max age: 300

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Create indexes for faster RLS policy evaluation
CREATE INDEX IF NOT EXISTS idx_storage_objects_bucket_owner
ON storage.objects (bucket_id, owner)
WHERE bucket_id IN ('tracks-private', 'tracks-public', 'tracks-temp');

CREATE INDEX IF NOT EXISTS idx_storage_objects_bucket_created
ON storage.objects (bucket_id, created_at DESC)
WHERE bucket_id = 'tracks-temp';

-- Index for path-based queries
CREATE INDEX IF NOT EXISTS idx_storage_objects_name_pattern
ON storage.objects (bucket_id, name text_pattern_ops)
WHERE bucket_id IN ('tracks-private', 'tracks-public');

-- ============================================================================
-- MIGRATION COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.generate_storage_path IS 'Generates standardized storage paths for track files following the pattern: {bucket}/{user_id}/{year}/{month}/{track_id}/{filename}';

COMMENT ON FUNCTION public.cleanup_temp_storage IS 'Removes temporary files older than 24 hours. Should be called by a scheduled cron job.';

COMMENT ON FUNCTION public.get_track_signed_url IS 'Validates access and returns storage path for generating signed URLs for private tracks.';

COMMENT ON VIEW public.user_storage_usage IS 'Provides storage usage metrics per user across all track-related buckets.';