#!/usr/bin/env node

/**
 * Verify audio_job_queue schema and refresh PostgREST cache
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking audio_job_queue schema...\n');

// Check column schema
const { data: columns, error: schemaError } = await supabase.rpc('exec_sql', {
  query: `
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audio_job_queue'
    ORDER BY ordinal_position;
  `
});

if (schemaError) {
  console.error('❌ Error checking schema:', schemaError);

  // Try direct query instead
  const { data, error } = await supabase
    .from('audio_job_queue')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error querying table:', error);
    console.log('\n💡 The job_data column issue is confirmed.');
    console.log('\n📋 Solution:');
    console.log('1. Go to: https://supabase.com/dashboard/project/byicqjniboevzbhbfxui/settings/api');
    console.log('2. Scroll to "PostgREST Configuration"');
    console.log('3. Click "Reload schema" button');
    process.exit(1);
  }

  console.log('✅ Table query succeeded (using direct select)');
  console.log('Columns available:', Object.keys(data[0] || {}));
} else {
  console.log('✅ Schema query succeeded');
  console.log('Columns:', columns);
}

console.log('\n🔄 Attempting to refresh PostgREST cache...');

// Try to send NOTIFY to refresh cache
const { error: notifyError } = await supabase.rpc('exec_sql', {
  query: "NOTIFY pgrst, 'reload schema';"
});

if (notifyError) {
  console.log('⚠️  Could not send NOTIFY (expected if exec_sql RPC doesn\'t exist)');
  console.log('\n📋 Manual refresh required:');
  console.log('1. Go to: https://supabase.com/dashboard/project/byicqjniboevzbhbfxui/settings/api');
  console.log('2. Scroll to "PostgREST Configuration"');
  console.log('3. Click "Reload schema" button');
} else {
  console.log('✅ Schema cache refresh triggered!');
  console.log('\nWait 10 seconds, then try creating a new track from the builder.');
}
