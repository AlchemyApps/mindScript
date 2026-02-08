-- Add cover_image_url to tracks table and create track-artwork storage bucket

BEGIN;

-- Add column
ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Create storage bucket for track artwork (public read, 5MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'track-artwork',
  'track-artwork',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: Users can upload to their own folder
CREATE POLICY "Users can upload own artwork"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'track-artwork'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: Users can update/delete their own artwork
CREATE POLICY "Users can manage own artwork"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'track-artwork'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: Public read for all artwork
CREATE POLICY "Public can view artwork"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'track-artwork');

COMMIT;
