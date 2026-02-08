-- Fix: check_voice_creation_limit trigger blocks free-tier users
-- even after they pay the $29 voice clone fee.
-- Updated logic: if user has a voice_clone purchase, allow 1 voice
-- regardless of subscription tier.

CREATE OR REPLACE FUNCTION public.check_voice_creation_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_subscription_tier TEXT;
  v_max_voices INTEGER;
  v_current_voices INTEGER;
  v_has_clone_purchase BOOLEAN;
BEGIN
  -- Get user's subscription tier
  SELECT subscription_tier
  INTO v_subscription_tier
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Set limits based on tier
  v_max_voices := CASE v_subscription_tier
    WHEN 'free' THEN 0
    WHEN 'basic' THEN 1
    WHEN 'premium' THEN 3
    WHEN 'enterprise' THEN 10
    ELSE 0
  END;

  -- Check if user has paid for voice cloning ($29 purchase)
  SELECT EXISTS(
    SELECT 1
    FROM public.purchases
    WHERE user_id = NEW.user_id
      AND metadata->>'type' = 'voice_clone'
      AND status = 'completed'
  ) INTO v_has_clone_purchase;

  -- If user has a voice_clone purchase, grant at least 1 voice slot
  IF v_has_clone_purchase AND v_max_voices < 1 THEN
    v_max_voices := 1;
  END IF;

  -- Count current active voices
  SELECT COUNT(*)
  INTO v_current_voices
  FROM public.cloned_voices
  WHERE user_id = NEW.user_id
    AND status IN ('pending', 'processing', 'active')
    AND deleted_at IS NULL;

  -- Check limit
  IF v_current_voices >= v_max_voices THEN
    RAISE EXCEPTION 'Voice creation limit reached for subscription tier %', v_subscription_tier;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
