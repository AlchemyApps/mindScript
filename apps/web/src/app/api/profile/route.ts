import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@mindscript/auth/server';
import { profileSchema, profileUpdateSchema } from '@mindscript/schemas';
import { z } from 'zod';

/**
 * GET /api/profile - Get current user profile
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch full profile with preferences
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        *,
        user_preferences (*)
      `)
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Combine profile with preferences
    const fullProfile = {
      ...profile,
      theme: profile.user_preferences?.[0]?.theme || 'system',
      notification_settings: profile.user_preferences?.[0]?.notification_settings || {},
      privacy_settings: profile.user_preferences?.[0]?.privacy_settings || {}
    };

    // Remove user_preferences array from response
    delete fullProfile.user_preferences;

    return NextResponse.json(fullProfile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/profile - Update user profile
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = profileUpdateSchema.parse(body);

    // Separate profile and preference updates
    const profileUpdate: any = {};
    const preferenceUpdate: any = {};

    if (validatedData.username !== undefined) profileUpdate.username = validatedData.username;
    if (validatedData.display_name !== undefined) profileUpdate.display_name = validatedData.display_name;
    if (validatedData.bio !== undefined) profileUpdate.bio = validatedData.bio;
    if (validatedData.avatar_url !== undefined) profileUpdate.avatar_url = validatedData.avatar_url;

    if (validatedData.theme !== undefined) preferenceUpdate.theme = validatedData.theme;
    if (validatedData.notification_settings !== undefined) {
      preferenceUpdate.notification_settings = validatedData.notification_settings;
    }
    if (validatedData.privacy_settings !== undefined) {
      preferenceUpdate.privacy_settings = validatedData.privacy_settings;
    }

    // Start a transaction-like update
    const updates = [];

    // Update profile if there are changes
    if (Object.keys(profileUpdate).length > 0) {
      profileUpdate.updated_at = new Date().toISOString();
      updates.push(
        supabase
          .from('profiles')
          .update(profileUpdate)
          .eq('id', user.id)
      );
    }

    // Update preferences if there are changes
    if (Object.keys(preferenceUpdate).length > 0) {
      preferenceUpdate.updated_at = new Date().toISOString();
      updates.push(
        supabase
          .from('user_preferences')
          .upsert({
            user_id: user.id,
            ...preferenceUpdate
          }, {
            onConflict: 'user_id'
          })
      );
    }

    // Execute all updates
    const results = await Promise.all(updates);
    
    // Check for errors
    for (const result of results) {
      if (result.error) {
        console.error('Update error:', result.error);
        return NextResponse.json(
          { error: result.error.message },
          { status: 400 }
        );
      }
    }

    // Fetch and return updated profile
    const { data: updatedProfile, error: fetchError } = await supabase
      .from('profiles')
      .select(`
        *,
        user_preferences (*)
      `)
      .eq('id', user.id)
      .single();

    if (fetchError || !updatedProfile) {
      return NextResponse.json(
        { error: 'Failed to fetch updated profile' },
        { status: 500 }
      );
    }

    // Combine profile with preferences
    const fullProfile = {
      ...updatedProfile,
      theme: updatedProfile.user_preferences?.[0]?.theme || 'system',
      notification_settings: updatedProfile.user_preferences?.[0]?.notification_settings || {},
      privacy_settings: updatedProfile.user_preferences?.[0]?.privacy_settings || {}
    };

    // Remove user_preferences array from response
    delete fullProfile.user_preferences;

    return NextResponse.json(fullProfile);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}