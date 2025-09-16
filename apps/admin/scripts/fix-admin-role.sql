-- Script to fix admin role in profiles table
-- Run this in Supabase SQL Editor

-- Step 1: Check current state
SELECT
  u.id,
  u.email,
  u.created_at as user_created,
  p.id as profile_id,
  p.email as profile_email,
  p.role as profile_role,
  p.account_status,
  p.created_at as profile_created
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE u.email = 'admin@mindscript.com';

-- Step 2: Ensure admin has a profile with super_admin role
-- This will insert a new profile if none exists, or update the existing one
INSERT INTO public.profiles (
  id,
  email,
  role,
  account_status,
  full_name,
  created_at,
  updated_at
)
SELECT
  id,
  email,
  'super_admin',
  'active',
  'Admin User',
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'admin@mindscript.com'
ON CONFLICT (id)
DO UPDATE SET
  role = 'super_admin',
  account_status = 'active',
  updated_at = NOW();

-- Step 3: Verify the fix
SELECT
  u.id,
  u.email,
  p.role,
  p.account_status,
  p.updated_at
FROM auth.users u
JOIN public.profiles p ON u.id = p.id
WHERE u.email = 'admin@mindscript.com';

-- Step 4: Optional - Set app_metadata role as backup
-- Note: This requires using Supabase Dashboard or Auth Admin API
-- Cannot be done via SQL directly
-- Go to: Dashboard > Authentication > Users > admin@mindscript.com > Edit
-- Add to app_metadata: { "role": "super_admin" }

-- Step 5: Ensure RLS policy allows user to read their own profile
-- This should already exist but let's make sure
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
    AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);
  END IF;
END $$;