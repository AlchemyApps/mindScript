-- Fix infinite recursion in profiles RLS policy
-- The existing policy queries profiles table from within the profiles RLS check,
-- causing infinite recursion. Simplify to just allow users to see their own profile.
-- Admins can use service_role for full access.

-- Drop the problematic policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Simple policy: users can only see their own profile
-- (Service role bypasses RLS for admin access)
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
