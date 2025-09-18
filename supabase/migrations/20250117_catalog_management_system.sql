-- Catalog Management System Migration
-- This migration creates tables for managing background music catalog with licensing

BEGIN;

-- Create background_tracks table for music catalog
CREATE TABLE IF NOT EXISTS public.background_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT,
  url TEXT NOT NULL, -- Storage URL for the audio file
  price_cents INTEGER NOT NULL DEFAULT 100,
  duration_seconds INTEGER,
  is_platform_asset BOOLEAN DEFAULT true,
  is_stereo BOOLEAN DEFAULT true,
  license_note TEXT,
  tags TEXT[] DEFAULT '{}',
  category TEXT,
  mood TEXT,
  genre TEXT,
  bpm INTEGER,
  key_signature TEXT,
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  file_size_bytes BIGINT,
  file_format TEXT,
  waveform_data JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT valid_price CHECK (price_cents >= 0),
  CONSTRAINT valid_duration CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  CONSTRAINT valid_bpm CHECK (bpm IS NULL OR (bpm >= 40 AND bpm <= 300)),
  CONSTRAINT valid_usage_count CHECK (usage_count >= 0)
);

-- Create track_licensing table for licensing information
CREATE TABLE IF NOT EXISTS public.track_licensing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES public.background_tracks(id) ON DELETE CASCADE,
  license_type TEXT NOT NULL, -- 'royalty_free', 'creative_commons', 'exclusive', 'subscription'
  license_provider TEXT,
  license_number TEXT,
  purchase_date DATE,
  expiry_date DATE,
  territory TEXT[] DEFAULT '{worldwide}',
  usage_restrictions TEXT,
  attribution_required BOOLEAN DEFAULT false,
  attribution_text TEXT,
  max_usage_count INTEGER,
  cost_usd DECIMAL(10, 2),
  renewal_required BOOLEAN DEFAULT false,
  renewal_cost_usd DECIMAL(10, 2),
  documentation_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_dates CHECK (expiry_date IS NULL OR expiry_date > purchase_date),
  CONSTRAINT valid_cost CHECK (cost_usd IS NULL OR cost_usd >= 0),
  CONSTRAINT valid_max_usage CHECK (max_usage_count IS NULL OR max_usage_count > 0)
);

-- Create track_usage_stats view for analytics (simplified version)
-- Will be extended when audio_tracks table exists
CREATE OR REPLACE VIEW public.track_usage_stats AS
SELECT
  bt.id,
  bt.title,
  bt.artist,
  bt.category,
  bt.mood,
  bt.price_cents,
  bt.is_platform_asset,
  bt.usage_count,
  bt.created_at,
  tl.license_type,
  tl.expiry_date,
  CASE
    WHEN tl.expiry_date IS NOT NULL AND tl.expiry_date < CURRENT_DATE THEN 'expired'
    WHEN tl.expiry_date IS NOT NULL AND tl.expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
    WHEN tl.max_usage_count IS NOT NULL AND bt.usage_count >= tl.max_usage_count THEN 'usage_limit_reached'
    WHEN bt.is_active = false THEN 'inactive'
    ELSE 'active'
  END AS status
FROM public.background_tracks bt
LEFT JOIN public.track_licensing tl ON bt.id = tl.track_id
GROUP BY bt.id, bt.title, bt.artist, bt.category, bt.mood, bt.price_cents,
         bt.is_platform_asset, bt.usage_count, bt.created_at,
         tl.license_type, tl.expiry_date, tl.max_usage_count, bt.is_active;

-- Create catalog_upload_batch table for tracking bulk uploads
CREATE TABLE IF NOT EXISTS public.catalog_upload_batch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  total_files INTEGER NOT NULL,
  processed_files INTEGER DEFAULT 0,
  successful_uploads INTEGER DEFAULT 0,
  failed_uploads INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  error_details JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_counts CHECK (
    processed_files >= 0 AND
    successful_uploads >= 0 AND
    failed_uploads >= 0 AND
    processed_files <= total_files AND
    successful_uploads <= processed_files AND
    failed_uploads <= processed_files
  )
);

-- Create catalog_upload_items table for individual files in batch
CREATE TABLE IF NOT EXISTS public.catalog_upload_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.catalog_upload_batch(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'skipped'
  track_id UUID REFERENCES public.background_tracks(id),
  error_message TEXT,
  processing_metadata JSONB DEFAULT '{}',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_background_tracks_active ON public.background_tracks(is_active) WHERE is_active = true;
CREATE INDEX idx_background_tracks_category ON public.background_tracks(category, is_active);
CREATE INDEX idx_background_tracks_mood ON public.background_tracks(mood) WHERE is_active = true;
CREATE INDEX idx_background_tracks_tags ON public.background_tracks USING GIN(tags);
CREATE INDEX idx_background_tracks_created_by ON public.background_tracks(created_by);
CREATE INDEX idx_background_tracks_usage ON public.background_tracks(usage_count DESC);
CREATE INDEX idx_background_tracks_search ON public.background_tracks
  USING GIN(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(artist, '')));

CREATE INDEX idx_track_licensing_track ON public.track_licensing(track_id);
CREATE INDEX idx_track_licensing_expiry ON public.track_licensing(expiry_date)
  WHERE expiry_date IS NOT NULL;
CREATE INDEX idx_track_licensing_type ON public.track_licensing(license_type);

CREATE INDEX idx_catalog_upload_batch_status ON public.catalog_upload_batch(status);
CREATE INDEX idx_catalog_upload_batch_user ON public.catalog_upload_batch(uploaded_by);
CREATE INDEX idx_catalog_upload_items_batch ON public.catalog_upload_items(batch_id);
CREATE INDEX idx_catalog_upload_items_status ON public.catalog_upload_items(status);

-- Create RLS policies
ALTER TABLE public.background_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_licensing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_upload_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_upload_items ENABLE ROW LEVEL SECURITY;

-- Background tracks policies
-- Public can read active platform assets
CREATE POLICY "Public can view active platform tracks"
  ON public.background_tracks
  FOR SELECT
  TO public
  USING (is_active = true AND is_platform_asset = true);

-- Authenticated users can read all active tracks
CREATE POLICY "Authenticated users can view active tracks"
  ON public.background_tracks
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admin users can do everything
CREATE POLICY "Admins can manage all tracks"
  ON public.background_tracks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Track licensing policies (admin only)
CREATE POLICY "Admins can manage licensing"
  ON public.track_licensing
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Upload batch policies (admin only)
CREATE POLICY "Admins can manage upload batches"
  ON public.catalog_upload_batch
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage upload items"
  ON public.catalog_upload_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Create trigger for updating updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_background_tracks_updated_at
  BEFORE UPDATE ON public.background_tracks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_track_licensing_updated_at
  BEFORE UPDATE ON public.track_licensing
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to increment usage count
CREATE OR REPLACE FUNCTION increment_track_usage(track_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.background_tracks
  SET usage_count = usage_count + 1
  WHERE id = track_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check license validity
CREATE OR REPLACE FUNCTION check_track_license_validity(track_uuid UUID)
RETURNS TABLE (
  is_valid BOOLEAN,
  reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN bt.is_active = false THEN false
      WHEN tl.expiry_date IS NOT NULL AND tl.expiry_date < CURRENT_DATE THEN false
      WHEN tl.max_usage_count IS NOT NULL AND bt.usage_count >= tl.max_usage_count THEN false
      ELSE true
    END AS is_valid,
    CASE
      WHEN bt.is_active = false THEN 'Track is inactive'
      WHEN tl.expiry_date IS NOT NULL AND tl.expiry_date < CURRENT_DATE THEN 'License expired'
      WHEN tl.max_usage_count IS NOT NULL AND bt.usage_count >= tl.max_usage_count THEN 'Usage limit reached'
      ELSE 'Valid'
    END AS reason
  FROM public.background_tracks bt
  LEFT JOIN public.track_licensing tl ON bt.id = tl.track_id
  WHERE bt.id = track_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add foreign key reference to audio_tracks table if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'audio_tracks'
  ) THEN
    -- Add column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'audio_tracks'
      AND column_name = 'background_track_id'
    ) THEN
      ALTER TABLE public.audio_tracks
      ADD COLUMN background_track_id UUID REFERENCES public.background_tracks(id);

      CREATE INDEX idx_audio_tracks_background ON public.audio_tracks(background_track_id);
    END IF;
  END IF;
END $$;

-- Insert sample data for development (only if table is empty)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.background_tracks LIMIT 1) THEN
    INSERT INTO public.background_tracks (
      title, artist, url, price_cents, duration_seconds,
      is_platform_asset, is_stereo, license_note, tags,
      category, mood, genre, bpm
    ) VALUES
    ('Peaceful Morning', 'Ambient Studios', 'https://storage.example.com/tracks/peaceful-morning.mp3',
     200, 180, true, true, 'Royalty-free for all uses',
     ARRAY['ambient', 'meditation', 'calm'], 'meditation', 'peaceful', 'ambient', 60),

    ('Focus Flow', 'Concentration Music Co', 'https://storage.example.com/tracks/focus-flow.mp3',
     300, 240, true, true, 'Licensed for commercial use',
     ARRAY['focus', 'study', 'concentration'], 'focus', 'neutral', 'electronic', 120),

    ('Nature Sounds - Ocean', 'Natural Audio', 'https://storage.example.com/tracks/ocean-waves.mp3',
     150, 300, true, true, 'Public domain',
     ARRAY['nature', 'ocean', 'relaxation'], 'nature', 'calming', 'nature', NULL),

    ('Binaural Base - Alpha', 'Frequency Lab', 'https://storage.example.com/tracks/binaural-alpha.mp3',
     250, 600, true, true, 'Stereo required for binaural effect',
     ARRAY['binaural', 'alpha', 'meditation'], 'binaural', 'focused', 'binaural', NULL),

    ('Healing Frequencies 528Hz', 'Solfeggio Sounds', 'https://storage.example.com/tracks/528hz.mp3',
     200, 360, true, true, 'Pure tone generation',
     ARRAY['solfeggio', '528hz', 'healing'], 'solfeggio', 'healing', 'frequency', NULL);

    -- Add sample licensing data
    INSERT INTO public.track_licensing (
      track_id, license_type, license_provider,
      purchase_date, territory, attribution_required
    )
    SELECT
      id,
      'royalty_free',
      'AudioJungle',
      CURRENT_DATE - INTERVAL '6 months',
      ARRAY['worldwide'],
      false
    FROM public.background_tracks
    WHERE title IN ('Peaceful Morning', 'Focus Flow')
    LIMIT 2;
  END IF;
END $$;

-- Grant appropriate permissions
GRANT SELECT ON public.track_usage_stats TO authenticated;
GRANT EXECUTE ON FUNCTION increment_track_usage TO authenticated;
GRANT EXECUTE ON FUNCTION check_track_license_validity TO authenticated;

COMMIT;