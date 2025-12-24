-- Allow sellers to manage their own seller_profiles rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE polname = 'Sellers can insert own seller profile'
      AND polrelid = 'public.seller_profiles'::regclass
  ) THEN
    CREATE POLICY "Sellers can insert own seller profile"
      ON public.seller_profiles
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE polname = 'Sellers can update own seller profile'
      AND polrelid = 'public.seller_profiles'::regclass
  ) THEN
    CREATE POLICY "Sellers can update own seller profile"
      ON public.seller_profiles
      FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
