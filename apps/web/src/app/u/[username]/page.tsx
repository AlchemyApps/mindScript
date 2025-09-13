import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createServerClient } from '@mindscript/auth/server';
import { ProfileView } from '@/components/profile';

interface PageProps {
  params: {
    username: string;
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createServerClient();
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, bio, username')
    .eq('username', params.username.toLowerCase())
    .single();

  if (!profile) {
    return {
      title: 'User Not Found | MindScript'
    };
  }

  return {
    title: `${profile.display_name || profile.username} | MindScript`,
    description: profile.bio || `View ${profile.display_name || profile.username}'s profile on MindScript`,
    openGraph: {
      title: profile.display_name || profile.username,
      description: profile.bio || `View ${profile.display_name || profile.username}'s profile on MindScript`,
      type: 'profile'
    }
  };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const supabase = await createServerClient();
  
  // Get current user (if authenticated)
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch profile by username
  const { data: profile, error } = await supabase
    .from('profiles')
    .select(`
      *,
      user_preferences!inner (
        privacy_settings
      )
    `)
    .eq('username', params.username.toLowerCase())
    .single();

  if (error || !profile) {
    notFound();
  }

  // Check if profile is public
  const privacySettings = profile.user_preferences?.[0]?.privacy_settings || {};
  const isProfilePublic = privacySettings.profile_visible !== false;
  const isOwnProfile = user?.id === profile.id;

  // If profile is private and not own profile, show 404
  if (!isProfilePublic && !isOwnProfile) {
    notFound();
  }

  // Prepare public profile data
  const publicProfile = {
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name,
    bio: profile.bio,
    avatar_url: profile.avatar_url,
    created_at: profile.created_at,
    email: isOwnProfile ? profile.email : undefined,
    email_verified: isOwnProfile ? profile.email_verified : undefined,
    account_status: isOwnProfile ? profile.account_status : undefined,
    theme: 'system',
    notification_settings: {},
    privacy_settings: {}
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <ProfileView profile={publicProfile} isOwnProfile={isOwnProfile} />
    </div>
  );
}