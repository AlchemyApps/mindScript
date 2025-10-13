-- Add first track discount tracking to profiles table
-- This migration adds a field to track if a user has used their first-track discount

-- Add first_track_discount_used column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS first_track_discount_used BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS first_track_discount_used_at TIMESTAMPTZ NULL;

-- Create index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_profiles_first_track_discount
ON public.profiles(first_track_discount_used)
WHERE first_track_discount_used = false;

-- Create function to mark first track discount as used
CREATE OR REPLACE FUNCTION public.mark_first_track_discount_used(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    already_used BOOLEAN;
BEGIN
    -- Check if already used and update atomically
    UPDATE public.profiles
    SET
        first_track_discount_used = true,
        first_track_discount_used_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE
        id = user_id
        AND first_track_discount_used = false
    RETURNING first_track_discount_used INTO already_used;

    -- Return true if we successfully marked it as used (was previously false)
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is eligible for first track discount
CREATE OR REPLACE FUNCTION public.is_eligible_for_first_track_discount(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    has_used BOOLEAN;
BEGIN
    -- If no user_id provided (anonymous user), they are eligible
    IF user_id IS NULL THEN
        RETURN true;
    END IF;

    -- Check if user has used their first track discount
    SELECT first_track_discount_used INTO has_used
    FROM public.profiles
    WHERE id = user_id;

    -- If user not found, treat as eligible (shouldn't happen but safe default)
    IF has_used IS NULL THEN
        RETURN true;
    END IF;

    -- Return true if they haven't used it yet
    RETURN NOT has_used;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policy for the new function (allow authenticated users to check their own eligibility)
GRANT EXECUTE ON FUNCTION public.is_eligible_for_first_track_discount(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.mark_first_track_discount_used(UUID) TO service_role;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.first_track_discount_used IS 'Whether the user has used their one-time first track discount';
COMMENT ON COLUMN public.profiles.first_track_discount_used_at IS 'Timestamp when the first track discount was used';
COMMENT ON FUNCTION public.mark_first_track_discount_used(UUID) IS 'Atomically marks a user as having used their first track discount';
COMMENT ON FUNCTION public.is_eligible_for_first_track_discount(UUID) IS 'Checks if a user is eligible for the first track discount';