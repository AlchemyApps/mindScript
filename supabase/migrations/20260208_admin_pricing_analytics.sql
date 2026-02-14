-- Migration: Admin Pricing Extensions & Analytics Functions
-- Date: 2026-02-08
-- Applied as: admin_pricing_analytics_v3

-- Add missing columns to admin_settings
ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_admin_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_settings_updated_at ON public.admin_settings;
CREATE TRIGGER admin_settings_updated_at
  BEFORE UPDATE ON public.admin_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_settings_timestamp();

-- Seed default values
INSERT INTO public.admin_settings (key, value, description, category)
VALUES
  ('edit_fee_cents', '99', 'Fee in cents for editing an existing track', 'pricing'),
  ('free_edit_limit', '3', 'Number of free edits before charging', 'pricing')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category
WHERE public.admin_settings.description IS NULL;

-- RLS
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_settings' AND policyname = 'Admins can read admin_settings') THEN
    CREATE POLICY "Admins can read admin_settings"
      ON public.admin_settings FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_settings' AND policyname = 'Admins can update admin_settings') THEN
    CREATE POLICY "Admins can update admin_settings"
      ON public.admin_settings FOR UPDATE
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_settings' AND policyname = 'Admins can insert admin_settings') THEN
    CREATE POLICY "Admins can insert admin_settings"
      ON public.admin_settings FOR INSERT
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
  END IF;
END $$;

-- Add price_cents to voice_catalog
ALTER TABLE public.voice_catalog ADD COLUMN IF NOT EXISTS price_cents INTEGER;

-- Analytics RPC: popular voices (join on provider_voice_id)
CREATE OR REPLACE FUNCTION get_popular_voices(
  start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  end_date TIMESTAMPTZ DEFAULT NOW(),
  max_results INTEGER DEFAULT 10
)
RETURNS TABLE (voice_id TEXT, voice_name TEXT, provider TEXT, tier TEXT, usage_count BIGINT)
LANGUAGE SQL STABLE
AS $$
  SELECT
    t.voice_config->>'voice_id',
    COALESCE(vc.display_name, t.voice_config->>'name', t.voice_config->>'voice_id'),
    COALESCE(vc.provider, t.voice_config->>'provider', 'unknown'),
    COALESCE(vc.tier, t.voice_config->>'tier', 'unknown'),
    COUNT(*)
  FROM public.tracks t
  LEFT JOIN public.voice_catalog vc ON vc.provider_voice_id = t.voice_config->>'voice_id'
  WHERE t.created_at >= start_date AND t.created_at <= end_date
    AND t.voice_config IS NOT NULL AND t.voice_config->>'voice_id' IS NOT NULL
  GROUP BY t.voice_config->>'voice_id', vc.display_name, t.voice_config->>'name', vc.provider, t.voice_config->>'provider', vc.tier, t.voice_config->>'tier'
  ORDER BY COUNT(*) DESC
  LIMIT max_results;
$$;

-- Analytics RPC: popular background tracks
CREATE OR REPLACE FUNCTION get_popular_background_tracks(
  start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  end_date TIMESTAMPTZ DEFAULT NOW(),
  max_results INTEGER DEFAULT 10
)
RETURNS TABLE (track_id TEXT, track_name TEXT, category TEXT, usage_count BIGINT)
LANGUAGE SQL STABLE
AS $$
  SELECT
    t.music_config->>'id',
    COALESCE(bt.title, t.music_config->>'name', t.music_config->>'id'),
    bt.category,
    COUNT(*)
  FROM public.tracks t
  LEFT JOIN public.background_tracks bt ON bt.slug = t.music_config->>'id'
  WHERE t.created_at >= start_date AND t.created_at <= end_date
    AND t.music_config IS NOT NULL AND t.music_config->>'id' IS NOT NULL
  GROUP BY t.music_config->>'id', bt.title, t.music_config->>'name', bt.category
  ORDER BY COUNT(*) DESC
  LIMIT max_results;
$$;

-- Analytics RPC: feature adoption
CREATE OR REPLACE FUNCTION get_feature_adoption(
  start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (total_tracks BIGINT, solfeggio_count BIGINT, solfeggio_pct NUMERIC, binaural_count BIGINT, binaural_pct NUMERIC, with_music_count BIGINT, with_music_pct NUMERIC)
LANGUAGE SQL STABLE
AS $$
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE frequency_config->'solfeggio'->>'enabled' = 'true'),
    ROUND(COUNT(*) FILTER (WHERE frequency_config->'solfeggio'->>'enabled' = 'true')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1),
    COUNT(*) FILTER (WHERE frequency_config->'binaural'->>'enabled' = 'true'),
    ROUND(COUNT(*) FILTER (WHERE frequency_config->'binaural'->>'enabled' = 'true')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1),
    COUNT(*) FILTER (WHERE music_config IS NOT NULL AND music_config->>'id' IS NOT NULL),
    ROUND(COUNT(*) FILTER (WHERE music_config IS NOT NULL AND music_config->>'id' IS NOT NULL)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1)
  FROM public.tracks
  WHERE created_at >= start_date AND created_at <= end_date;
$$;
