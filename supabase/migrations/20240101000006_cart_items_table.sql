-- Create cart_items table for persistent cart management
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity = 1), -- Always 1 for digital tracks
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  
  -- Ensure unique cart items per user/session and track
  CONSTRAINT unique_cart_item UNIQUE(COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::UUID), session_id, track_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON public.cart_items(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cart_items_session_id ON public.cart_items(session_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_track_id ON public.cart_items(track_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_expires_at ON public.cart_items(expires_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cart_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.expires_at = NOW() + INTERVAL '7 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_cart_items_updated_at_trigger
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW
  EXECUTE FUNCTION update_cart_items_updated_at();

-- Function to clean up expired cart items
CREATE OR REPLACE FUNCTION cleanup_expired_cart_items()
RETURNS void AS $$
BEGIN
  DELETE FROM public.cart_items
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own cart items
CREATE POLICY "Users can view own cart items" ON public.cart_items
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR 
    (user_id IS NULL AND session_id = current_setting('app.session_id', true))
  );

-- Policy: Users can insert their own cart items
CREATE POLICY "Users can insert own cart items" ON public.cart_items
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR 
    (user_id IS NULL AND session_id = current_setting('app.session_id', true))
  );

-- Policy: Users can update their own cart items
CREATE POLICY "Users can update own cart items" ON public.cart_items
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR 
    (user_id IS NULL AND session_id = current_setting('app.session_id', true))
  )
  WITH CHECK (
    auth.uid() = user_id
    OR 
    (user_id IS NULL AND session_id = current_setting('app.session_id', true))
  );

-- Policy: Users can delete their own cart items
CREATE POLICY "Users can delete own cart items" ON public.cart_items
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR 
    (user_id IS NULL AND session_id = current_setting('app.session_id', true))
  );

-- Grant permissions to authenticated and anon users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO anon;

-- Comment on table and columns
COMMENT ON TABLE public.cart_items IS 'Shopping cart items for track purchases';
COMMENT ON COLUMN public.cart_items.user_id IS 'User ID for authenticated users, NULL for guests';
COMMENT ON COLUMN public.cart_items.session_id IS 'Session ID for both guests and authenticated users';
COMMENT ON COLUMN public.cart_items.track_id IS 'Reference to the track being purchased';
COMMENT ON COLUMN public.cart_items.quantity IS 'Always 1 for digital tracks';
COMMENT ON COLUMN public.cart_items.expires_at IS 'Cart item expiry after 7 days of inactivity';