-- Force PostgREST schema cache reload
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/byicqjniboevzbhbfxui/sql/new

-- First verify the job_data column exists
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'audio_job_queue'
ORDER BY ordinal_position;

-- Send notification to PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
