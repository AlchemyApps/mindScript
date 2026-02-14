-- Add soft-delete columns to profiles table for 30-day account deletion grace period
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_scheduled_for TIMESTAMPTZ;

-- Index for finding accounts pending deletion (used by cleanup cron)
CREATE INDEX IF NOT EXISTS idx_profiles_deletion_scheduled
  ON public.profiles(deletion_scheduled_for)
  WHERE deletion_scheduled_for IS NOT NULL;
