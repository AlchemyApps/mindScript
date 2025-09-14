-- Create purchases table for storing checkout transactions
CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT, -- Can be NULL for guest checkout
  session_id TEXT NOT NULL, -- For tracking guest purchases
  stripe_payment_intent_id TEXT NOT NULL UNIQUE,
  stripe_checkout_session_id TEXT NOT NULL UNIQUE,
  amount_total INTEGER NOT NULL CHECK (amount_total >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  refund_amount INTEGER CHECK (refund_amount >= 0),
  metadata JSONB,
  CONSTRAINT valid_refund CHECK (
    (refunded_at IS NULL AND refund_amount IS NULL) OR
    (refunded_at IS NOT NULL AND refund_amount IS NOT NULL)
  )
);

-- Create purchase_items table for individual track purchases
CREATE TABLE IF NOT EXISTS public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.tracks(id),
  seller_id TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  platform_fee INTEGER NOT NULL CHECK (platform_fee >= 0),
  seller_earnings INTEGER NOT NULL CHECK (seller_earnings >= 0),
  stripe_price_id TEXT,
  stripe_product_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_earnings CHECK (seller_earnings + platform_fee = price)
);

-- Create track_access table for managing who can access purchased tracks
CREATE TABLE IF NOT EXISTS public.track_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT, -- Can be NULL for guest access
  session_id TEXT NOT NULL, -- For tracking guest access
  track_id UUID NOT NULL REFERENCES public.tracks(id),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  access_type TEXT NOT NULL CHECK (access_type IN ('purchase', 'gift', 'promotion')),
  CONSTRAINT unique_user_track_access UNIQUE NULLS NOT DISTINCT (user_id, track_id, purchase_id),
  CONSTRAINT unique_session_track_access UNIQUE (session_id, track_id, purchase_id)
);

-- Create webhook_events table for idempotency
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_purchases_user_id ON public.purchases(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_purchases_session_id ON public.purchases(session_id);
CREATE INDEX idx_purchases_status ON public.purchases(status);
CREATE INDEX idx_purchases_created_at ON public.purchases(created_at DESC);
CREATE INDEX idx_purchases_stripe_payment_intent ON public.purchases(stripe_payment_intent_id);

CREATE INDEX idx_purchase_items_purchase_id ON public.purchase_items(purchase_id);
CREATE INDEX idx_purchase_items_track_id ON public.purchase_items(track_id);
CREATE INDEX idx_purchase_items_seller_id ON public.purchase_items(seller_id);

CREATE INDEX idx_track_access_user_id ON public.track_access(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_track_access_session_id ON public.track_access(session_id);
CREATE INDEX idx_track_access_track_id ON public.track_access(track_id);
CREATE INDEX idx_track_access_purchase_id ON public.track_access(purchase_id);
CREATE INDEX idx_track_access_granted_at ON public.track_access(granted_at DESC);

CREATE INDEX idx_webhook_events_stripe_event_id ON public.webhook_events(stripe_event_id);
CREATE INDEX idx_webhook_events_type ON public.webhook_events(type);
CREATE INDEX idx_webhook_events_status ON public.webhook_events(status);
CREATE INDEX idx_webhook_events_created_at ON public.webhook_events(created_at DESC);

-- Enable RLS
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for purchases
CREATE POLICY "Users can view their own purchases"
  ON public.purchases
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "Service role can manage all purchases"
  ON public.purchases
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for purchase_items
CREATE POLICY "Users can view their own purchase items"
  ON public.purchase_items
  FOR SELECT
  TO authenticated
  USING (
    purchase_id IN (
      SELECT id FROM public.purchases
      WHERE user_id = auth.uid()::text
    )
  );

CREATE POLICY "Sellers can view items they sold"
  ON public.purchase_items
  FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid()::text);

CREATE POLICY "Service role can manage all purchase items"
  ON public.purchase_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for track_access
CREATE POLICY "Users can view their own track access"
  ON public.track_access
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "Service role can manage all track access"
  ON public.track_access
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for webhook_events (restricted to service role only)
CREATE POLICY "Only service role can access webhook events"
  ON public.webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to check if a user has access to a track
CREATE OR REPLACE FUNCTION public.has_track_access(
  p_user_id TEXT,
  p_session_id TEXT,
  p_track_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user owns the track
  IF EXISTS (
    SELECT 1 FROM public.tracks
    WHERE id = p_track_id AND user_id = p_user_id
  ) THEN
    RETURN true;
  END IF;

  -- Check if user has purchased access
  IF p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.track_access
    WHERE track_id = p_track_id
      AND user_id = p_user_id
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
  ) THEN
    RETURN true;
  END IF;

  -- Check if session has purchased access (guest checkout)
  IF p_session_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.track_access
    WHERE track_id = p_track_id
      AND session_id = p_session_id
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
  ) THEN
    RETURN true;
  END IF;

  -- Check if track is free/public
  IF EXISTS (
    SELECT 1 FROM public.tracks
    WHERE id = p_track_id
      AND is_public = true
      AND (price_cents IS NULL OR price_cents = 0)
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Function to update earnings ledger on purchase
CREATE OR REPLACE FUNCTION public.update_earnings_on_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only process completed purchases
  IF NEW.status = 'succeeded' AND (OLD IS NULL OR OLD.status != 'succeeded') THEN
    -- Insert earnings ledger entries for each item
    INSERT INTO public.earnings_ledger (
      purchase_id,
      seller_id,
      track_id,
      gross_cents,
      platform_fee_cents,
      processing_fee_cents,
      seller_cut_cents,
      status,
      created_at
    )
    SELECT
      NEW.id,
      pi.seller_id,
      pi.track_id,
      pi.price,
      pi.platform_fee,
      CEIL(pi.price * 0.029 + 30), -- Stripe fee estimate: 2.9% + 30¢
      pi.seller_earnings,
      'pending',
      NOW()
    FROM public.purchase_items pi
    WHERE pi.purchase_id = NEW.id;
  END IF;

  -- Handle refunds
  IF NEW.status = 'refunded' AND (OLD IS NULL OR OLD.status != 'refunded') THEN
    -- Update earnings ledger for refunds
    UPDATE public.earnings_ledger
    SET status = 'refunded',
        updated_at = NOW()
    WHERE purchase_id = NEW.id;

    -- Revoke track access
    UPDATE public.track_access
    SET revoked_at = NOW()
    WHERE purchase_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for earnings update
CREATE TRIGGER update_earnings_on_purchase_trigger
  AFTER INSERT OR UPDATE ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_earnings_on_purchase();

-- Function to handle updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_purchases_updated_at
  BEFORE UPDATE ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_webhook_events_updated_at
  BEFORE UPDATE ON public.webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();