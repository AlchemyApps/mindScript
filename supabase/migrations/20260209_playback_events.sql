-- ============================================================================
-- Playback Events: Analytics table for mobile + web playback tracking
-- ============================================================================

-- ============================================================================
-- Create playback_events table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.playback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('play', 'pause', 'resume', 'complete', 'skip', 'seek')),
  duration_listened_seconds INTEGER DEFAULT 0 CHECK (duration_listened_seconds >= 0),
  total_track_duration_seconds INTEGER CHECK (total_track_duration_seconds >= 0),
  platform TEXT NOT NULL CHECK (platform IN ('mobile_ios', 'mobile_android', 'web')),
  device_info JSONB DEFAULT '{}'::JSONB,
  session_id UUID,
  position_seconds NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_playback_events_user_id ON public.playback_events(user_id);
CREATE INDEX idx_playback_events_track_id ON public.playback_events(track_id);
CREATE INDEX idx_playback_events_created_at ON public.playback_events(created_at DESC);
CREATE INDEX idx_playback_events_platform ON public.playback_events(platform);
CREATE INDEX idx_playback_events_session ON public.playback_events(session_id);
CREATE INDEX idx_playback_events_user_created ON public.playback_events(user_id, created_at DESC);
CREATE INDEX idx_playback_events_user_platform ON public.playback_events(user_id, platform);
CREATE INDEX idx_playback_events_event_type ON public.playback_events(event_type);

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE public.playback_events ENABLE ROW LEVEL SECURITY;

-- Users can insert their own playback events
CREATE POLICY "Users can insert own playback events"
  ON public.playback_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own playback events
CREATE POLICY "Users can read own playback events"
  ON public.playback_events FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all playback events
CREATE POLICY "Admins can read all playback events"
  ON public.playback_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (role_flags->>'is_admin')::boolean = true
    )
  );

-- ============================================================================
-- RPC: User listening stats
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_listening_stats(
  p_user_id UUID,
  p_start TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  -- Verify caller is the user or an admin
  IF auth.uid() != p_user_id AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (role_flags->>'is_admin')::boolean = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT json_build_object(
    'total_listens', COALESCE(COUNT(*) FILTER (WHERE event_type = 'play'), 0),
    'total_seconds', COALESCE(SUM(duration_listened_seconds), 0),
    'unique_tracks', COALESCE(COUNT(DISTINCT track_id), 0),
    'most_active_hour', (
      SELECT EXTRACT(HOUR FROM created_at)::INTEGER
      FROM public.playback_events
      WHERE user_id = p_user_id
        AND created_at BETWEEN p_start AND p_end
        AND event_type = 'play'
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ),
    'platform_breakdown', (
      SELECT COALESCE(json_object_agg(platform, cnt), '{}'::JSON)
      FROM (
        SELECT platform, COUNT(*) as cnt
        FROM public.playback_events
        WHERE user_id = p_user_id
          AND created_at BETWEEN p_start AND p_end
          AND event_type = 'play'
        GROUP BY platform
      ) sub
    )
  ) INTO result
  FROM public.playback_events
  WHERE user_id = p_user_id
    AND created_at BETWEEN p_start AND p_end;

  RETURN result;
END;
$$;

-- ============================================================================
-- RPC: Platform-wide listening stats (admin only)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_platform_listening_stats(
  p_start TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  -- Admin check
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (role_flags->>'is_admin')::boolean = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  SELECT json_build_object(
    'total_plays', COALESCE(COUNT(*) FILTER (WHERE event_type = 'play'), 0),
    'total_completes', COALESCE(COUNT(*) FILTER (WHERE event_type = 'complete'), 0),
    'unique_listeners', COALESCE(COUNT(DISTINCT user_id), 0),
    'total_hours', COALESCE(ROUND(SUM(duration_listened_seconds)::NUMERIC / 3600, 1), 0),
    'mobile_plays', COALESCE(COUNT(*) FILTER (WHERE event_type = 'play' AND platform IN ('mobile_ios', 'mobile_android')), 0),
    'web_plays', COALESCE(COUNT(*) FILTER (WHERE event_type = 'play' AND platform = 'web'), 0),
    'avg_daily_plays', COALESCE(
      ROUND(COUNT(*) FILTER (WHERE event_type = 'play')::NUMERIC /
        GREATEST(EXTRACT(DAY FROM p_end - p_start), 1), 1
      ), 0
    ),
    'peak_hour', (
      SELECT EXTRACT(HOUR FROM created_at)::INTEGER
      FROM public.playback_events
      WHERE created_at BETWEEN p_start AND p_end
        AND event_type = 'play'
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ),
    'plays_over_time', (
      SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.date), '[]'::JSON)
      FROM (
        SELECT
          DATE_TRUNC('day', created_at)::DATE as date,
          COUNT(*) FILTER (WHERE event_type = 'play') as plays,
          COUNT(DISTINCT user_id) as unique_users
        FROM public.playback_events
        WHERE created_at BETWEEN p_start AND p_end
        GROUP BY DATE_TRUNC('day', created_at)::DATE
      ) sub
    )
  ) INTO result
  FROM public.playback_events
  WHERE created_at BETWEEN p_start AND p_end;

  RETURN result;
END;
$$;

-- ============================================================================
-- RPC: Atomic increment of play_count on tracks
-- ============================================================================

CREATE OR REPLACE FUNCTION public.increment_play_count(p_track_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.tracks
  SET play_count = COALESCE(play_count, 0) + 1,
      updated_at = NOW()
  WHERE id = p_track_id;
END;
$$;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.playback_events IS 'Tracks all playback events from mobile and web clients for analytics';
COMMENT ON FUNCTION public.get_user_listening_stats IS 'Returns listening statistics for a specific user within a date range';
COMMENT ON FUNCTION public.get_platform_listening_stats IS 'Returns platform-wide listening statistics (admin only)';
COMMENT ON FUNCTION public.increment_play_count IS 'Atomically increments the play_count on a track';
