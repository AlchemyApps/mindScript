import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@mindscript/auth/server';
import { publicProfileSchema } from '@mindscript/schemas';

/**
 * GET /api/profile/[username] - Get public profile by username
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { username: string } }
) {
  try {
    const { username } = params;
    
    if (!username || username.length < 3) {
      return NextResponse.json(
        { error: 'Invalid username' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Fetch profile by username
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        id,
        username,
        display_name,
        bio,
        avatar_url,
        created_at,
        user_preferences!inner (
          privacy_settings
        )
      `)
      .eq('username', username.toLowerCase())
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Check if profile is public
    const privacySettings = profile.user_preferences?.[0]?.privacy_settings || {};
    const isProfilePublic = privacySettings.profile_visible !== false;

    if (!isProfilePublic) {
      // Check if requesting user is the profile owner
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || user.id !== profile.id) {
        return NextResponse.json(
          { error: 'This profile is private' },
          { status: 403 }
        );
      }
    }

    // Return public profile data
    const publicProfile = publicProfileSchema.parse({
      id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      bio: profile.bio,
      avatar_url: profile.avatar_url,
      created_at: profile.created_at
    });

    return NextResponse.json(publicProfile);
  } catch (error) {
    console.error('Error fetching public profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}