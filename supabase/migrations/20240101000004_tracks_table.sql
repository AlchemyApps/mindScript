-- ============================================================================
-- Phase 2.2.3.1: Tracks Table Creation
-- ============================================================================
-- This migration creates the tracks table for audio track management with:
-- - Track metadata and configuration
-- - Voice, music, and frequency configurations
-- - Output settings and status tracking
-- - Comprehensive RLS policies
-- - Storage integration preparation
-- ============================================================================

-- ============================================================================
-- Create Tracks Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  script TEXT NOT NULL,
  
  -- Voice configuration (JSONB for flexibility)
  voice_config JSONB NOT NULL DEFAULT '{}'::JSONB,
  
  -- Music configuration (optional)
  music_config JSONB,
  
  -- Frequency configuration (Solfeggio/Binaural)
  frequency_config JSONB,
  
  -- Output configuration
  output_config JSONB NOT NULL DEFAULT '{"format": "mp3", "quality": "standard", "is_public": false}'::JSONB,
  
  -- Track metadata
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_public BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Render job tracking
  render_job_id UUID,
  audio_url TEXT,
  duration_seconds INTEGER CHECK (duration_seconds >= 0),
  
  -- Stats
  play_count INTEGER DEFAULT 0 CHECK (play_count >= 0),
  
  -- Pricing (for marketplace)
  price_cents INTEGER CHECK (price_cents >= 0),
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT script_length CHECK (char_length(script) >= 10 AND char_length(script) <= 5000),
  CONSTRAINT title_length CHECK (char_length(title) >= 1 AND char_length(title) <= 255),
  CONSTRAINT description_length CHECK (char_length(description) <= 2000),
  CONSTRAINT tags_limit CHECK (array_length(tags, 1) <= 10)
);

-- ============================================================================
-- Create Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tracks_user_id ON public.tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_tracks_status ON public.tracks(status);
CREATE INDEX IF NOT EXISTS idx_tracks_is_public ON public.tracks(is_public);
CREATE INDEX IF NOT EXISTS idx_tracks_created_at ON public.tracks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracks_updated_at ON public.tracks(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracks_deleted_at ON public.tracks(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_tags ON public.tracks USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_tracks_render_job_id ON public.tracks(render_job_id) WHERE render_job_id IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tracks_user_status ON public.tracks(user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_public_status ON public.tracks(is_public, status) WHERE deleted_at IS NULL AND is_public = true;

-- ============================================================================
-- Enable RLS
-- ============================================================================

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Users can view their own tracks
CREATE POLICY "Users can view own tracks" 
  ON public.tracks FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can view public tracks
CREATE POLICY "Anyone can view public tracks" 
  ON public.tracks FOR SELECT 
  USING (is_public = true AND deleted_at IS NULL);

-- Users can create their own tracks
CREATE POLICY "Users can create own tracks" 
  ON public.tracks FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own tracks
CREATE POLICY "Users can update own tracks" 
  ON public.tracks FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own tracks (soft delete via update)
CREATE POLICY "Users can delete own tracks" 
  ON public.tracks FOR UPDATE 
  USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all tracks
CREATE POLICY "Admins can view all tracks" 
  ON public.tracks FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND (role_flags->>'is_admin')::boolean = true
    )
  );

-- Admins can manage all tracks
CREATE POLICY "Admins can manage all tracks" 
  ON public.tracks FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND (role_flags->>'is_admin')::boolean = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND (role_flags->>'is_admin')::boolean = true
    )
  );

-- ============================================================================
-- Triggers
-- ============================================================================

-- Apply updated_at trigger
CREATE TRIGGER update_tracks_updated_at 
  BEFORE UPDATE ON public.tracks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Storage Buckets
-- ============================================================================

-- Create audio files bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio-files',
  'audio-files',
  false, -- Private bucket, we'll use signed URLs
  52428800, -- 50MB limit
  ARRAY['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav']
) ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS Policy for audio files bucket
CREATE POLICY "Users can upload own audio files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'audio-files' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own audio files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'audio-files' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'audio-files' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own audio files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'audio-files' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can view their own files and public files they have access to
CREATE POLICY "Users can view accessible audio files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'audio-files' AND (
      auth.uid()::text = (storage.foldername(name))[1] OR
      EXISTS (
        SELECT 1 FROM public.tracks t
        WHERE t.audio_url LIKE '%' || name || '%'
        AND (t.user_id = auth.uid() OR t.is_public = true)
        AND t.deleted_at IS NULL
      )
    )
  );

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to validate voice config structure
CREATE OR REPLACE FUNCTION public.validate_voice_config(config JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  -- Must have provider and voice_id
  IF NOT (config ? 'provider' AND config ? 'voice_id') THEN
    RETURN FALSE;
  END IF;
  
  -- Provider must be valid
  IF NOT (config->>'provider' IN ('openai', 'elevenlabs', 'uploaded')) THEN
    RETURN FALSE;
  END IF;
  
  -- Voice_id must be non-empty string
  IF char_length(config->>'voice_id') < 1 THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to validate output config structure
CREATE OR REPLACE FUNCTION public.validate_output_config(config JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  -- Must have format and quality
  IF NOT (config ? 'format' AND config ? 'quality') THEN
    RETURN FALSE;
  END IF;
  
  -- Format must be valid
  IF NOT (config->>'format' IN ('mp3', 'wav')) THEN
    RETURN FALSE;
  END IF;
  
  -- Quality must be valid
  IF NOT (config->>'quality' IN ('standard', 'high')) THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add constraints using the validation functions
ALTER TABLE public.tracks 
ADD CONSTRAINT valid_voice_config 
CHECK (public.validate_voice_config(voice_config));

ALTER TABLE public.tracks 
ADD CONSTRAINT valid_output_config 
CHECK (public.validate_output_config(output_config));

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE public.tracks IS 'Audio tracks created by users with voice, music, and frequency configurations';
COMMENT ON COLUMN public.tracks.voice_config IS 'Voice configuration: provider, voice_id, settings';
COMMENT ON COLUMN public.tracks.music_config IS 'Background music configuration: url, volume_db';
COMMENT ON COLUMN public.tracks.frequency_config IS 'Solfeggio and binaural configuration';
COMMENT ON COLUMN public.tracks.output_config IS 'Output format, quality, and privacy settings';
COMMENT ON COLUMN public.tracks.render_job_id IS 'Reference to async render job';
COMMENT ON COLUMN public.tracks.deleted_at IS 'Soft delete timestamp';

-- ============================================================================
-- Sample Data (Development Only)
-- ============================================================================

-- Only insert sample data in development
DO $$
BEGIN
  -- Check if we're in a development environment (this is a simple check)
  IF current_setting('app.environment', true) = 'development' THEN
    -- Insert sample track (only if no tracks exist)
    INSERT INTO public.tracks (
      id,
      user_id,
      title,
      description,
      script,
      voice_config,
      output_config,
      status,
      tags
    )
    SELECT 
      'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      p.id,
      'Sample Meditation Track',
      'A calming meditation track for relaxation',
      'Take a deep breath and relax. Let all your worries fade away as you find peace in this moment.',
      '{"provider": "openai", "voice_id": "alloy", "settings": {}}'::JSONB,
      '{"format": "mp3", "quality": "standard", "is_public": true}'::JSONB,
      'published',
      ARRAY['meditation', 'relaxation']
    FROM public.profiles p
    WHERE (p.role_flags->>'is_admin')::boolean = true
    LIMIT 1
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;