-- Fix RLS policy for pending_tracks to allow authenticated users to read tracks
-- This was missing from the original migration and causing checkout to fail

-- Drop the existing service-only policy
DROP POLICY IF EXISTS "pending_tracks_service_role_policy" ON pending_tracks;

-- Allow authenticated users to read any pending track
-- (they need this when redirected to checkout with a track_id)
CREATE POLICY "pending_tracks_select_authenticated" ON pending_tracks
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow service role to manage all pending tracks
CREATE POLICY "pending_tracks_service_role_all" ON pending_tracks
  FOR ALL
  USING (auth.role() = 'service_role');