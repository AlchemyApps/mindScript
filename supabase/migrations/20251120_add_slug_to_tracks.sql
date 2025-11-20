-- Add slug column for marketplace-friendly track URLs
ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- Backfill existing slugs from titles if empty
UPDATE public.tracks
SET slug = LOWER(
  regexp_replace(
    regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g'),
    '-{2,}', '-', 'g'
  )
)
WHERE (slug IS NULL OR slug = '')
  AND title IS NOT NULL;

-- Ensure slugs are unique for published tracks
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_slug_unique
  ON public.tracks(slug)
  WHERE deleted_at IS NULL
    AND slug IS NOT NULL;

-- Helper function to generate slugs from titles
CREATE OR REPLACE FUNCTION public.generate_track_slug(p_title TEXT)
RETURNS TEXT AS $$
DECLARE
  v_slug TEXT;
BEGIN
  IF p_title IS NULL THEN
    RETURN NULL;
  END IF;

  v_slug := LOWER(
    regexp_replace(
      regexp_replace(p_title, '[^a-zA-Z0-9]+', '-', 'g'),
      '-{2,}', '-', 'g'
    )
  );

  v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');

  IF v_slug IS NULL OR v_slug = '' THEN
    v_slug := SUBSTRING(replace(uuid_generate_v4()::TEXT, '-', '') FROM 1 FOR 12);
  END IF;

  RETURN v_slug;
END;
$$ LANGUAGE plpgsql;

-- Trigger to ensure slug is set on insert/update when missing
CREATE OR REPLACE FUNCTION public.sync_track_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.generate_track_slug(NEW.title);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_track_slug ON public.tracks;
CREATE TRIGGER set_track_slug
  BEFORE INSERT OR UPDATE OF title, slug
  ON public.tracks
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_track_slug();
