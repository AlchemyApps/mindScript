import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://byicqjniboevzbhbfxui.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5aWNxam5pYm9ldnpiaGJmeHVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1Mjg0NjAsImV4cCI6MjA3MzEwNDQ2MH0.FYzFTV7k2ZdR-QaPcBIwAK0yfJeqVgYqqVlSx9YVJ_U';

console.log('Testing Supabase Dev Auth - Confirmed user login...');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLogin() {
  try {
    const testEmail = 'testuser123@gmail.com';
    const testPassword = 'Test123456!';

    console.log(`\nAttempting to sign in as ${testEmail} (confirmed user)...`);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (error) {
      console.error('Signin error:', error);
    } else {
      console.log('✅ Signin successful!');
      console.log('User ID:', data.user?.id);
      console.log('Email:', data.user?.email);
      console.log('Email confirmed:', data.user?.email_confirmed_at ? 'Yes' : 'No');
      console.log('Session token:', data.session?.access_token ? 'Present' : 'None');
      console.log('Expires at:', data.session?.expires_at ? new Date(data.session.expires_at * 1000).toISOString() : 'N/A');

      // Sign out
      await supabase.auth.signOut();
      console.log('✅ Signed out successfully');
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testLogin();