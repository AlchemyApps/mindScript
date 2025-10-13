#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://byicqjniboevzbhbfxui.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5aWNxam5pYm9ldnpiaGJmeHVpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzUyODQ2MCwiZXhwIjoyMDczMTA0NDYwfQ.2dNm2fWyUUBjWQTTV1gYhXDuJNcbjApAkcNe95dW24k',
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

// Query to check current policies on profiles table
const { data, error } = await supabase
  .from('pg_policies')
  .select('*')
  .eq('tablename', 'profiles');

if (error) {
  console.error('Error:', error);
} else {
  console.log('Current policies on profiles table:');
  console.log(JSON.stringify(data, null, 2));
}

process.exit(0);
