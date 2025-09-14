-- Create playlists table
CREATE TABLE IF NOT EXISTS public.playlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  CONSTRAINT playlists_title_length CHECK (char_length(title) >= 1 AND char_length(title) <= 255),
  CONSTRAINT playlists_description_length CHECK (char_length(description) <= 5000)
);

-- Create playlist_tracks junction table
CREATE TABLE IF NOT EXISTS public.playlist_tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  added_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  added_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Ensure unique track per playlist
  CONSTRAINT playlist_tracks_unique UNIQUE (playlist_id, track_id),
  -- Ensure unique position per playlist
  CONSTRAINT playlist_tracks_position_unique UNIQUE (playlist_id, position),
  -- Ensure position is positive
  CONSTRAINT playlist_tracks_position_positive CHECK (position >= 0)
);

-- Create track_access table for purchased tracks
CREATE TABLE IF NOT EXISTS public.track_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  access_type VARCHAR(50) NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  purchase_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  
  -- Ensure unique access per user per track
  CONSTRAINT track_access_unique UNIQUE (user_id, track_id),
  -- Valid access types
  CONSTRAINT track_access_type_check CHECK (access_type IN ('owned', 'purchased', 'gift', 'subscription'))
);

-- Add indexes for performance
CREATE INDEX idx_playlists_user_id ON public.playlists(user_id);
CREATE INDEX idx_playlists_is_public ON public.playlists(is_public) WHERE is_public = true;
CREATE INDEX idx_playlists_created_at ON public.playlists(created_at DESC);

CREATE INDEX idx_playlist_tracks_playlist_id ON public.playlist_tracks(playlist_id);
CREATE INDEX idx_playlist_tracks_track_id ON public.playlist_tracks(track_id);
CREATE INDEX idx_playlist_tracks_position ON public.playlist_tracks(playlist_id, position);

CREATE INDEX idx_track_access_user_id ON public.track_access(user_id);
CREATE INDEX idx_track_access_track_id ON public.track_access(track_id);
CREATE INDEX idx_track_access_user_track ON public.track_access(user_id, track_id);

-- RLS Policies for playlists
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

-- Users can view their own playlists
CREATE POLICY "Users can view own playlists" ON public.playlists
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can view public playlists
CREATE POLICY "Users can view public playlists" ON public.playlists
  FOR SELECT
  USING (is_public = true);

-- Users can create their own playlists
CREATE POLICY "Users can create own playlists" ON public.playlists
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own playlists
CREATE POLICY "Users can update own playlists" ON public.playlists
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own playlists
CREATE POLICY "Users can delete own playlists" ON public.playlists
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for playlist_tracks
ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;

-- Users can view tracks in their playlists
CREATE POLICY "Users can view tracks in own playlists" ON public.playlist_tracks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists
      WHERE playlists.id = playlist_tracks.playlist_id
      AND playlists.user_id = auth.uid()
    )
  );

-- Users can view tracks in public playlists
CREATE POLICY "Users can view tracks in public playlists" ON public.playlist_tracks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists
      WHERE playlists.id = playlist_tracks.playlist_id
      AND playlists.is_public = true
    )
  );

-- Users can add tracks to their playlists
CREATE POLICY "Users can add tracks to own playlists" ON public.playlist_tracks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.playlists
      WHERE playlists.id = playlist_tracks.playlist_id
      AND playlists.user_id = auth.uid()
    )
    AND added_by = auth.uid()
  );

-- Users can update tracks in their playlists
CREATE POLICY "Users can update tracks in own playlists" ON public.playlist_tracks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists
      WHERE playlists.id = playlist_tracks.playlist_id
      AND playlists.user_id = auth.uid()
    )
  );

-- Users can remove tracks from their playlists
CREATE POLICY "Users can remove tracks from own playlists" ON public.playlist_tracks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists
      WHERE playlists.id = playlist_tracks.playlist_id
      AND playlists.user_id = auth.uid()
    )
  );

-- RLS Policies for track_access
ALTER TABLE public.track_access ENABLE ROW LEVEL SECURITY;

-- Users can view their own track access
CREATE POLICY "Users can view own track access" ON public.track_access
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage track access
CREATE POLICY "Service role can manage track access" ON public.track_access
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Function to reorder playlist tracks
CREATE OR REPLACE FUNCTION reorder_playlist_tracks(
  p_playlist_id UUID,
  p_track_id UUID,
  p_new_position INTEGER
)
RETURNS VOID AS $$
DECLARE
  v_old_position INTEGER;
  v_user_id UUID;
BEGIN
  -- Get user_id and verify ownership
  SELECT user_id INTO v_user_id
  FROM public.playlists
  WHERE id = p_playlist_id;
  
  IF v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this playlist';
  END IF;
  
  -- Get current position
  SELECT position INTO v_old_position
  FROM public.playlist_tracks
  WHERE playlist_id = p_playlist_id AND track_id = p_track_id;
  
  IF v_old_position IS NULL THEN
    RAISE EXCEPTION 'Track not found in playlist';
  END IF;
  
  -- Reorder tracks
  IF v_old_position < p_new_position THEN
    -- Moving down
    UPDATE public.playlist_tracks
    SET position = position - 1
    WHERE playlist_id = p_playlist_id
      AND position > v_old_position
      AND position <= p_new_position;
  ELSIF v_old_position > p_new_position THEN
    -- Moving up
    UPDATE public.playlist_tracks
    SET position = position + 1
    WHERE playlist_id = p_playlist_id
      AND position >= p_new_position
      AND position < v_old_position;
  END IF;
  
  -- Update track position
  UPDATE public.playlist_tracks
  SET position = p_new_position
  WHERE playlist_id = p_playlist_id AND track_id = p_track_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add track to playlist with auto-positioning
CREATE OR REPLACE FUNCTION add_track_to_playlist(
  p_playlist_id UUID,
  p_track_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_max_position INTEGER;
  v_new_id UUID;
BEGIN
  -- Verify ownership
  SELECT user_id INTO v_user_id
  FROM public.playlists
  WHERE id = p_playlist_id;
  
  IF v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this playlist';
  END IF;
  
  -- Check if track already exists in playlist
  IF EXISTS (
    SELECT 1 FROM public.playlist_tracks
    WHERE playlist_id = p_playlist_id AND track_id = p_track_id
  ) THEN
    RAISE EXCEPTION 'Track already exists in playlist';
  END IF;
  
  -- Get max position
  SELECT COALESCE(MAX(position), -1) + 1 INTO v_max_position
  FROM public.playlist_tracks
  WHERE playlist_id = p_playlist_id;
  
  -- Insert track
  INSERT INTO public.playlist_tracks (playlist_id, track_id, position, added_by)
  VALUES (p_playlist_id, p_track_id, v_max_position, auth.uid())
  RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update playlist updated_at
CREATE OR REPLACE FUNCTION update_playlist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.playlists
  SET updated_at = now()
  WHERE id = COALESCE(NEW.playlist_id, OLD.playlist_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER playlist_tracks_update_playlist_timestamp
  AFTER INSERT OR UPDATE OR DELETE ON public.playlist_tracks
  FOR EACH ROW
  EXECUTE FUNCTION update_playlist_updated_at();