import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://byicqjniboevzbhbfxui.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5aWNxam5pYm9ldnpiaGJmeHVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1Mjg0NjAsImV4cCI6MjA3MzEwNDQ2MH0.FYzFTV7k2ZdR-QaPcBIwAK0yfJeqVgYqqVlSx9YVJ_U';

console.log('Testing Supabase Dev Auth...');
console.log('URL:', supabaseUrl);
console.log('Key prefix:', supabaseAnonKey.substring(0, 20) + '...');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAuth() {
  try {
    // Test signing in with the admin user
    console.log('\nAttempting to sign in with admin@mindscript.com...');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'admin@mindscript.com',
      password: 'AdminMindScript123!'
    });

    if (error) {
      console.error('Auth error:', error);
      return;
    }

    console.log('✅ Auth successful!');
    console.log('User ID:', data.user?.id);
    console.log('Email:', data.user?.email);
    console.log('Session:', data.session ? 'Valid' : 'None');

    // Sign out
    await supabase.auth.signOut();
    console.log('✅ Signed out successfully');
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testAuth();