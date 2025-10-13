#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://byicqjniboevzbhbfxui.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5aWNxam5pYm9ldnpiaGJmeHVpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzUyODQ2MCwiZXhwIjoyMDczMTA0NDYwfQ.2dNm2fWyUUBjWQTTV1gYhXDuJNcbjApAkcNe95dW24k',
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

const sql = `
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
`;

// Execute each statement separately
const statements = sql.split(';').filter(s => s.trim());

for (const statement of statements) {
  if (statement.trim()) {
    console.log('Executing:', statement.substring(0, 50) + '...');
    const { error } = await supabase.rpc('exec', { sql: statement + ';' });
    if (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  }
}

console.log('✅ RLS policies fixed successfully!');
process.exit(0);
