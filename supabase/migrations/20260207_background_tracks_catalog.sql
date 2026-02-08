-- Background Music Catalog: Add description + attributes columns, seed 7 new tracks
-- Updates existing 4 tracks with descriptions/attributes, fixes categories

-- Add missing columns
ALTER TABLE public.background_tracks
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS attributes TEXT[] DEFAULT '{}';

-- Update existing 4 tracks with descriptions, attributes, and corrected categories
UPDATE public.background_tracks SET
  description = 'Relaxing emotional acoustic guitar with gentle fingerpicking over a water stream bed',
  attributes = ARRAY['relaxing','acoustic guitar','fingerpicking','warm','emotional','water'],
  category = 'Relaxing Guitar'
WHERE slug = 'acoustic-reflection';

UPDATE public.background_tracks SET
  description = 'Nature-inspired ambient music with forest atmosphere and warm organic textures',
  attributes = ARRAY['ambient','nature','forest','organic','warm','spatial'],
  category = 'Nature Ambient'
WHERE slug = 'deep-forest-float';

UPDATE public.background_tracks SET
  description = 'Flowing spa ambient with warm deep textures',
  attributes = ARRAY['spa','ambient','warm','flowing','deep','relaxing'],
  category = 'Spa'
WHERE slug = 'serene-spa-flow';

UPDATE public.background_tracks SET
  description = 'Traditional Tibetan singing bowl meditation soundscape',
  attributes = ARRAY['singing bowls','tibetan','meditation','traditional','resonant'],
  category = 'Meditation'
WHERE slug = 'tibetan-singing-bowls';

-- Insert 7 new tracks (NULL bpm for non-rhythmic tracks to satisfy valid_bpm CHECK >= 40)
INSERT INTO public.background_tracks (
  title, slug, description, url, price_cents, duration_seconds,
  is_platform_asset, is_stereo, category, bpm, key_signature, attributes, tags,
  is_active
) VALUES
(
  'Aquatic Guitar',
  'aquatic-guitar',
  'Relaxing aquatic acoustic guitar with gentle fingerpicking and water-inspired atmosphere',
  'aquatic-guitar.wav',
  99, 300, true, true,
  'Relaxing Guitar', 80, 'A minor',
  ARRAY['relaxing','acoustic guitar','fingerpicking','water','warm','emotional'],
  ARRAY['relaxing','guitar','water'],
  true
),
(
  'Piano Solace',
  'piano-solace',
  'Solo contemplative piano with spacious reverb and emotional melody',
  'piano-solace.wav',
  99, 300, true, true,
  'Piano', 120, 'C major',
  ARRAY['piano','contemplative','minimal','emotional','spacious','reverb'],
  ARRAY['piano','contemplative'],
  true
),
(
  'Warm Drift',
  'warm-drift',
  'Deep analog pads with no melody - pure warmth for meditation and deep relaxation',
  'warm-drift.wav',
  99, 300, true, true,
  'Meditation', 120, 'D# major',
  ARRAY['pads','drone','warm','deep','meditation','analog','no melody'],
  ARRAY['meditation','pads','drone'],
  true
),
(
  'Tidal Breath',
  'tidal-breath',
  'Rhythmic ambient swell mimicking breathing with gentle ocean waves underneath',
  'tidal-breath.wav',
  99, 300, true, true,
  'Breathwork', NULL, 'G major',
  ARRAY['breathwork','rhythmic','oceanic','waves','meditative','breathing'],
  ARRAY['breathwork','ocean','waves'],
  true
),
(
  'Stone Garden',
  'stone-garden',
  'Zen-inspired sparse plucked strings with silence between notes and gentle birds and wind',
  'stone-garden.wav',
  99, 300, true, true,
  'Zen', 120, 'D# major',
  ARRAY['zen','japanese','koto','sparse','plucked strings','minimal','birds','wind'],
  ARRAY['zen','japanese','koto'],
  true
),
(
  'Singing Bowls',
  'singing-bowls',
  'Tibetan singing bowls with harmonic overtones and gentle zen ocean waves',
  'singing-bowls.wav',
  99, 300, true, true,
  'Meditation', 120, 'B major',
  ARRAY['singing bowls','tibetan','meditation','healing','overtones','drone','waves'],
  ARRAY['meditation','singing bowls','tibetan'],
  true
),
(
  'Music Box Dreams',
  'music-box-dreams',
  'Music box lullaby with celesta and soft piano - winding down melody for sleep',
  'music-box-dreams.wav',
  99, 300, true, true,
  'Sleep', NULL, 'C# minor',
  ARRAY['lullaby','music box','celesta','sleep','gentle','hypnotic','dreamy'],
  ARRAY['sleep','lullaby','music box'],
  true
)
ON CONFLICT (slug) DO NOTHING;

-- Increase bucket size limit to accommodate WAV files
UPDATE storage.buckets SET file_size_limit = 60000000 WHERE id = 'background-music';
