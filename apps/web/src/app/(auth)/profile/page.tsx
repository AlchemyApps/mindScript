import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerClient } from '@mindscript/auth/server';
import { ProfileView } from '@/components/profile';

export const metadata: Metadata = {
  title: 'Profile | MindScript',
  description: 'View and manage your MindScript profile'
};

export default async function ProfilePage() {
  const supabase = await createServerClient();
  
  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    redirect('/auth/login');
  }

  // Fetch full profile data
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(`
      *,
      user_preferences (*)
    `)
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    // Profile should exist due to trigger, but handle edge case
    redirect('/auth/login');
  }

  // Combine profile with preferences
  const fullProfile = {
    ...profile,
    theme: profile.user_preferences?.[0]?.theme || 'system',
    notification_settings: profile.user_preferences?.[0]?.notification_settings || {},
    privacy_settings: profile.user_preferences?.[0]?.privacy_settings || {}
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <ProfileView profile={fullProfile} isOwnProfile={true} />
    </div>
  );
}