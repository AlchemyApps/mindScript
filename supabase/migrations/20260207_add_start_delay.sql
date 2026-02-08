-- Add start_delay_seconds to tracks table
-- Controls how many seconds of background music play before the voice begins

BEGIN;

ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS start_delay_seconds INTEGER DEFAULT 3;

-- Constrain to reasonable range
ALTER TABLE public.tracks
  ADD CONSTRAINT chk_start_delay_range
  CHECK (start_delay_seconds >= 0 AND start_delay_seconds <= 300);

COMMIT;
