import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://byicqjniboevzbhbfxui.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5aWNxam5pYm9ldnpiaGJmeHVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1Mjg0NjAsImV4cCI6MjA3MzEwNDQ2MH0.FYzFTV7k2ZdR-QaPcBIwAK0yfJeqVgYqqVlSx9YVJ_U';

console.log('Testing Supabase Dev Auth - Creating test user...');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSignup() {
  try {
    // Create a test user
    const testEmail = 'test@example.com';
    const testPassword = 'Test123456!';

    console.log(`\nAttempting to sign up ${testEmail}...`);
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    });

    if (signupError) {
      console.error('Signup error:', signupError);
    } else {
      console.log('✅ Signup successful!');
      console.log('User ID:', signupData.user?.id);
      console.log('Email:', signupData.user?.email);
    }

    // Now try to sign in with the new user
    console.log(`\nAttempting to sign in as ${testEmail}...`);
    const { data: signinData, error: signinError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (signinError) {
      console.error('Signin error:', signinError);
    } else {
      console.log('✅ Signin successful!');
      console.log('User ID:', signinData.user?.id);
      console.log('Session:', signinData.session ? 'Valid' : 'None');

      // Sign out
      await supabase.auth.signOut();
      console.log('✅ Signed out successfully');
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testSignup();