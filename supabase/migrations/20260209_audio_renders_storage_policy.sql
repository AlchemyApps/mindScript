-- Allow authenticated users to read (SELECT) from the audio-renders bucket.
-- This enables the mobile app to create signed URLs using the anon/authenticated client.
-- Security: the tracks table RLS already controls which audio_url values a user can discover,
-- so this policy only lets them sign URLs for files they've been given paths to.

CREATE POLICY "Authenticated users can read audio renders"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'audio-renders');
